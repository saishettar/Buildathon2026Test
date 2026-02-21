"""Claude-powered analysis: run performance reports & step summaries."""
from __future__ import annotations

import os
import json
import logging
from typing import Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ── Response models ────────────────────────────────────────────────────────────

class RunAnalysis(BaseModel):
    summary: str
    token_analysis: str
    cost_analysis: str
    latency_analysis: str
    error_analysis: str
    recommendations: list[str]
    score: int = 0              # 0-100 optimization score
    usage: dict = Field(default_factory=dict)


class StepSummary(BaseModel):
    plain_summary: str          # "What this step did" in plain English
    input_summary: str          # Human-readable version of raw input
    output_summary: str         # Human-readable version of raw output
    performance_note: str       # Quick perf observation
    usage: dict = Field(default_factory=dict)


# ── Prompts ────────────────────────────────────────────────────────────────────

RUN_ANALYSIS_SYSTEM = """\
You are a performance analyst for an AI agent orchestration platform. \
You analyze workflow execution data and produce structured performance reports.

You MUST return valid JSON matching this exact schema (no markdown, no code fences):
{
  "summary": "2-3 sentence executive summary of the workflow run",
  "token_analysis": "Analysis of token usage across steps — which steps use the most, \
prompt vs completion ratio, waste",
  "cost_analysis": "Cost breakdown — biggest cost drivers, potential savings",
  "latency_analysis": "Timing analysis — bottlenecks, sequential vs parallel opportunities, \
critical path",
  "error_analysis": "Error analysis — failures, retries, reliability assessment (say 'No errors detected' if none)",
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2", "..."],
  "score": 75
}

The score is 0-100 rating how optimized the workflow is:
- 90-100: Excellent — minimal waste
- 70-89: Good — some improvements possible
- 50-69: Fair — significant optimization potential
- 0-49: Needs work — major inefficiencies

Be specific: mention step names, token counts, durations, and dollar amounts.
"""

STEP_SUMMARY_SYSTEM = """\
You are a technical writer who translates raw AI agent step data into \
clear, human-readable explanations that a non-technical person can understand.

You MUST return valid JSON matching this exact schema (no markdown, no code fences):
{
  "plain_summary": "1-2 sentence explanation of what this step did, as if explaining \
to a non-technical person",
  "input_summary": "Human-readable description of what was given to this step (the input data)",
  "output_summary": "Human-readable description of what this step produced (the output data)",
  "performance_note": "One sentence about this step's performance (fast/slow, expensive/cheap, \
any issues)"
}

Guidelines:
- Avoid jargon — say "searched for flights" not "invoked flight_search_api tool"
- Include key data points — prices, names, dates — from the raw data
- For errors, explain what went wrong in plain language
- Keep each field to 1-3 sentences max
"""


def _get_client():
    """Get Anthropic client or None if no key."""
    import anthropic
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    return anthropic.AsyncAnthropic(api_key=api_key)


def _format_steps_table(steps: list[dict]) -> str:
    """Create a compact text table of steps for Claude."""
    lines = []
    for i, s in enumerate(steps, 1):
        err = f" [ERROR: {s['error']['message']}]" if s.get("error") else ""
        parent = f"(parent:{s['parent_step_id'][:8]})" if s.get("parent_step_id") else "(root)"
        lines.append(
            f"{i}. {s['name']} | type={s['type']} status={s['status']} "
            f"| {s.get('duration_ms',0)}ms | "
            f"tokens={s.get('tokens_prompt',0)}p+{s.get('tokens_completion',0)}c "
            f"| cost=${s.get('cost_usd',0):.4f} "
            f"| {parent}{err}"
        )
    return "\n".join(lines)


# ── Run analysis ───────────────────────────────────────────────────────────────

async def analyze_run(run_data: dict, steps_data: list[dict]) -> RunAnalysis:
    """Use Claude to produce a structured performance analysis of a run."""
    client = _get_client()
    if not client:
        return RunAnalysis(
            summary="API key not configured.",
            token_analysis="N/A", cost_analysis="N/A",
            latency_analysis="N/A", error_analysis="N/A",
            recommendations=["Set ANTHROPIC_API_KEY to enable analysis"],
            score=0,
        )

    total_tokens = sum(s.get("tokens_prompt", 0) + s.get("tokens_completion", 0) for s in steps_data)
    total_cost = sum(s.get("cost_usd", 0) for s in steps_data)
    total_duration = sum(s.get("duration_ms", 0) for s in steps_data)
    failed = [s for s in steps_data if s.get("status") == "failed"]

    user_msg = (
        f"Analyze this workflow run:\n\n"
        f"Run: {run_data.get('run_id','?')} | Status: {run_data.get('status','?')} "
        f"| System: {run_data.get('system_type','?')}\n"
        f"Steps: {len(steps_data)} | Total tokens: {total_tokens:,} "
        f"| Total cost: ${total_cost:.4f} | Total duration: {total_duration:,}ms "
        f"| Failures: {len(failed)}\n\n"
        f"Step details:\n{_format_steps_table(steps_data)}"
    )

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=RUN_ANALYSIS_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        data = json.loads(raw)
        return RunAnalysis(
            summary=data.get("summary", ""),
            token_analysis=data.get("token_analysis", ""),
            cost_analysis=data.get("cost_analysis", ""),
            latency_analysis=data.get("latency_analysis", ""),
            error_analysis=data.get("error_analysis", ""),
            recommendations=data.get("recommendations", []),
            score=data.get("score", 50),
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        )
    except json.JSONDecodeError:
        logger.exception("Failed to parse Claude analysis JSON")
        return RunAnalysis(
            summary="Analysis completed but output could not be parsed.",
            token_analysis="N/A", cost_analysis="N/A",
            latency_analysis="N/A", error_analysis="N/A",
            recommendations=["Try running the analysis again"],
            score=50,
        )
    except Exception as e:
        logger.exception("Run analysis error")
        return RunAnalysis(
            summary=f"Analysis error: {str(e)}",
            token_analysis="N/A", cost_analysis="N/A",
            latency_analysis="N/A", error_analysis="N/A",
            recommendations=[],
            score=0,
        )


# ── Step summarization ─────────────────────────────────────────────────────────

async def summarize_step(step_data: dict) -> StepSummary:
    """Use Claude to produce a human-readable summary of a step."""
    client = _get_client()
    if not client:
        return StepSummary(
            plain_summary="API key not configured.",
            input_summary="N/A",
            output_summary="N/A",
            performance_note="N/A",
        )

    err_block = ""
    if step_data.get("error"):
        err_block = f"\nError: {json.dumps(step_data['error'])}"

    user_msg = (
        f"Summarize this workflow step:\n\n"
        f"Name: {step_data.get('name','?')}\n"
        f"Type: {step_data.get('type','?')} | Status: {step_data.get('status','?')}\n"
        f"Duration: {step_data.get('duration_ms',0)}ms\n"
        f"Tokens: {step_data.get('tokens_prompt',0)} prompt + "
        f"{step_data.get('tokens_completion',0)} completion\n"
        f"Cost: ${step_data.get('cost_usd',0):.4f}\n"
        f"\nRaw Input:\n{json.dumps(step_data.get('input', {}), indent=2)}\n"
        f"\nRaw Output:\n{json.dumps(step_data.get('output', {}), indent=2)}"
        f"{err_block}"
    )

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            system=STEP_SUMMARY_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        data = json.loads(raw)
        return StepSummary(
            plain_summary=data.get("plain_summary", ""),
            input_summary=data.get("input_summary", ""),
            output_summary=data.get("output_summary", ""),
            performance_note=data.get("performance_note", ""),
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        )
    except json.JSONDecodeError:
        logger.exception("Failed to parse step summary JSON")
        return StepSummary(
            plain_summary="Summary could not be parsed.",
            input_summary="See raw data below.",
            output_summary="See raw data below.",
            performance_note="N/A",
        )
    except Exception as e:
        logger.exception("Step summary error")
        return StepSummary(
            plain_summary=f"Error: {str(e)}",
            input_summary="N/A",
            output_summary="N/A",
            performance_note="N/A",
        )
