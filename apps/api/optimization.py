"""Optimisation router – GET /api/optimization

Calls the analytics engine, sends results + raw CSV data to Claude,
and returns structured optimisation recommendations.
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger(__name__)

# ── In-memory cache ────────────────────────────────────────────────────────────
_cache: dict[str, Any] = {
    "response": None,
    "timestamp": 0.0,
}
_CACHE_TTL = 600  # 10 minutes


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.get("/api/optimization")
async def get_optimization():
    """Return AI-generated optimisation recommendations for the agent fleet."""

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return _no_key_response()

    # Check cache
    now = time.time()
    if _cache["response"] is not None and (now - _cache["timestamp"]) < _CACHE_TTL:
        logger.info("Returning cached optimization response")
        return _cache["response"]

    # ── 1. Compute analytics ──────────────────────────────────────────────
    from analytics_engine import compute_analytics, get_runs_csv_text, get_steps_csv_text

    analytics = compute_analytics()
    runs_csv_full = get_runs_csv_text()
    steps_csv_full = get_steps_csv_text()

    # Truncate CSVs to a representative sample (header + first N rows)
    # The full analytics summary already captures stats from ALL rows,
    # so Claude only needs a sample to understand the data shape.
    def _truncate_csv(csv_text: str, max_rows: int = 100) -> str:
        lines = csv_text.splitlines()
        if len(lines) <= max_rows + 1:
            return csv_text
        sample = lines[: max_rows + 1]  # header + max_rows data rows
        sample.append(f"# ... ({len(lines) - max_rows - 1} more rows omitted — see analytics_summary for full stats)")
        return "\n".join(sample)

    runs_csv = _truncate_csv(runs_csv_full, max_rows=150)
    steps_csv = _truncate_csv(steps_csv_full, max_rows=250)

    # ── 2. Build Claude prompt ────────────────────────────────────────────
    system_prompt = (
        "You are an AI operations advisor analyzing a fleet of AI agents for an "
        "observability platform called Tenor (UAOP – Universal Agent Observability "
        "Platform). You have access to a representative sample of raw run/step "
        "data plus a COMPLETE pre-computed analytics summary covering ALL 1,000 "
        "runs and 7,388 steps. Your job is to analyze patterns, identify "
        "inefficiencies, and suggest actionable optimizations.\n\n"
        "IMPORTANT: The analytics_summary section contains stats computed from the "
        "FULL dataset. Use those numbers as your primary data source. The CSV "
        "samples are provided for schema context and spot-checking.\n\n"
        "Be specific — reference actual scenario names, model names, and concrete "
        "numbers from the data.\n\n"
        "Respond ONLY with valid JSON in exactly this structure (no markdown, no "
        "code fences, just raw JSON):\n"
        "{\n"
        '  "overall_score": <number 0-100>,\n'
        '  "summary": "<brief overall assessment of fleet health>",\n'
        '  "agent_recommendations": [\n'
        "    {\n"
        '      "scenario": "<scenario_name>",\n'
        '      "priority": "high|medium|low",\n'
        '      "category": "cost|reliability|speed|consolidation",\n'
        '      "title": "<short title>",\n'
        '      "suggestion": "<detailed actionable suggestion>",\n'
        '      "estimated_impact": "<what improvement to expect>"\n'
        "    }\n"
        "  ],\n"
        '  "automation_suggestions": [\n'
        "    {\n"
        '      "title": "<short title>",\n'
        '      "description": "<what to automate and why>",\n'
        '      "affected_scenarios": ["<scenario1>", "<scenario2>"],\n'
        '      "effort": "low|medium|high",\n'
        '      "impact": "high|medium|low"\n'
        "    }\n"
        "  ],\n"
        '  "model_recommendations": [\n'
        "    {\n"
        '      "current_model": "<model-id>",\n'
        '      "suggested_model": "<model-id>",\n'
        '      "affected_scenarios": ["<scenario1>"],\n'
        '      "reason": "<why switch>",\n'
        '      "estimated_savings": "<$ or % savings>"\n'
        "    }\n"
        "  ],\n"
        '  "agents_to_watch": [\n'
        "    {\n"
        '      "scenario": "<scenario_name>",\n'
        '      "reason": "<why this needs attention>",\n'
        '      "metric": "<the specific metric that is concerning>"\n'
        "    }\n"
        "  ]\n"
        "}\n"
    )

    user_message = (
        "Here is agent execution data (sample rows + full analytics):\n\n"
        "<runs_data_sample>\n"
        f"{runs_csv}\n"
        "</runs_data_sample>\n\n"
        "<steps_data_sample>\n"
        f"{steps_csv}\n"
        "</steps_data_sample>\n\n"
        "<analytics_summary>\n"
        "This summary is computed from the COMPLETE dataset (all 1,000 runs and 7,388 steps):\n"
        f"{json.dumps(analytics, indent=2, default=str)}\n"
        "</analytics_summary>\n\n"
        "Based on this data, provide optimization recommendations in the specified "
        "JSON format. Focus on:\n"
        "1. Agents with high failure rates and what's causing them\n"
        "2. Expensive agents that could use cheaper models without quality loss\n"
        "3. Slow agents that could be optimized\n"
        "4. Agents doing similar work that could be consolidated\n"
        "5. Workflow automations that would improve reliability (retries, fallbacks, scheduling)\n"
        "6. Model-level recommendations (which models to swap for which use cases)\n"
    )

    # ── 3. Call Claude ────────────────────────────────────────────────────
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        raw_text = message.content[0].text
        # Strip potential markdown fences
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        result = json.loads(cleaned)

    except json.JSONDecodeError:
        logger.error("Claude returned non-JSON – using raw text as summary")
        result = _fallback_response(raw_text)  # type: ignore[possibly-undefined]
    except Exception as exc:
        logger.exception("Error calling Claude API")
        result = _error_response(str(exc))
        # Don't cache errors — allow immediate retry
        return result

    # ── 4. Cache successful results and return ────────────────────────────
    _cache["response"] = result
    _cache["timestamp"] = time.time()
    return result


# ── Fallback / error helpers ──────────────────────────────────────────────────

def _no_key_response() -> dict:
    return {
        "overall_score": 0,
        "summary": "Set ANTHROPIC_API_KEY environment variable to enable AI optimization analysis",
        "agent_recommendations": [],
        "automation_suggestions": [],
        "model_recommendations": [],
        "agents_to_watch": [],
    }


def _error_response(error: str) -> dict:
    return {
        "overall_score": 0,
        "summary": f"Error generating optimization analysis: {error}",
        "agent_recommendations": [],
        "automation_suggestions": [],
        "model_recommendations": [],
        "agents_to_watch": [],
    }


def _fallback_response(raw: str) -> dict:
    return {
        "overall_score": 50,
        "summary": raw[:500],
        "agent_recommendations": [],
        "automation_suggestions": [],
        "model_recommendations": [],
        "agents_to_watch": [],
    }
