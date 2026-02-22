"""Claude-powered chatbot for agentic workflow optimization suggestions."""
from __future__ import annotations

import os
import logging
from typing import Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Request / Response models ──────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    run_id: Optional[str] = None
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str
    usage: dict = Field(default_factory=dict)


# ── System prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are an expert AI workflow optimization advisor embedded in Tenor, an AI Agent \
Observability Platform. Your job is to analyze agentic workflow execution \
traces and suggest concrete, actionable optimizations.

When given workflow data (runs with steps), analyze:
1. **Parallelization opportunities** – steps that could run concurrently instead of sequentially.
2. **Cost reduction** – unnecessary LLM calls, oversized prompts, cheaper model substitutions.
3. **Latency improvements** – caching, batching, or skipping redundant tool calls.
4. **Error handling** – missing retries, better fallback strategies, circuit breakers.
5. **Token efficiency** – prompt compression, output format optimization.
6. **Architecture** – whether the plan/execute pattern is optimal or if a ReAct or \
tree-of-thought approach would work better.

Be specific: reference step names, token counts, costs, and timing from the data. \
Provide estimated savings where possible (e.g., "Parallelizing steps X and Y could \
reduce total latency by ~40%").

If no workflow data is provided, give general best-practice advice for optimizing \
agentic workflows. Keep answers concise and actionable.
"""


def _format_workflow_context(run_data: dict | None, steps_data: list[dict] | None) -> str:
    """Format run and step data into a readable context block for the LLM."""
    if not run_data and not steps_data:
        return ""

    parts = []
    if run_data:
        parts.append(
            f"## Current Workflow Run\n"
            f"- Run ID: {run_data.get('run_id', 'N/A')}\n"
            f"- Status: {run_data.get('status', 'N/A')}\n"
            f"- System: {run_data.get('system_type', 'N/A')}\n"
            f"- Created: {run_data.get('created_at', 'N/A')}"
        )

    if steps_data:
        total_tokens = sum(s.get("tokens_prompt", 0) + s.get("tokens_completion", 0) for s in steps_data)
        total_cost = sum(s.get("cost_usd", 0) for s in steps_data)
        total_duration = sum(s.get("duration_ms", 0) for s in steps_data)
        failed_steps = [s for s in steps_data if s.get("status") == "failed"]

        parts.append(
            f"\n## Workflow Steps ({len(steps_data)} total)\n"
            f"- Total tokens: {total_tokens:,}\n"
            f"- Total cost: ${total_cost:.4f}\n"
            f"- Total duration: {total_duration:,}ms\n"
            f"- Failed steps: {len(failed_steps)}"
        )

        parts.append("\n### Step Details:")
        for i, step in enumerate(steps_data, 1):
            error_info = ""
            if step.get("error"):
                err = step["error"]
                error_info = f"\n  Error: {err.get('message', 'Unknown')}"

            parent_info = f" (parent: {step['parent_step_id'][:8]})" if step.get("parent_step_id") else " (root)"
            parts.append(
                f"\n{i}. **{step.get('name', 'Unnamed')}**{parent_info}\n"
                f"   - Type: {step.get('type', '?')} | Status: {step.get('status', '?')}\n"
                f"   - Duration: {step.get('duration_ms', 0)}ms\n"
                f"   - Tokens: {step.get('tokens_prompt', 0)} prompt + "
                f"{step.get('tokens_completion', 0)} completion\n"
                f"   - Cost: ${step.get('cost_usd', 0):.4f}"
                f"{error_info}"
            )

    return "\n".join(parts)


async def get_chat_response(
    request: ChatRequest,
    run_data: dict | None = None,
    steps_data: list[dict] | None = None,
) -> ChatResponse:
    """Send messages to Claude and return the optimization advice."""
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return ChatResponse(
            reply=(
                "⚠️ The `ANTHROPIC_API_KEY` environment variable is not set. "
                "Please set it and restart the API server to enable the AI advisor.\n\n"
                "```bash\n"
                "export ANTHROPIC_API_KEY=sk-ant-...\n"
                "```"
            ),
            usage={},
        )

    # Build the system message with workflow context
    workflow_context = _format_workflow_context(run_data, steps_data)
    system_content = SYSTEM_PROMPT
    if workflow_context:
        system_content += f"\n\n---\n\n# Workflow Data for Analysis\n\n{workflow_context}"

    # Convert our messages to Anthropic format
    api_messages = [{"role": m.role, "content": m.content} for m in request.messages]

    client = anthropic.AsyncAnthropic(api_key=api_key)

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_content,
            messages=api_messages,
        )

        reply_text = response.content[0].text if response.content else "No response generated."
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }

        return ChatResponse(reply=reply_text, usage=usage)

    except anthropic.AuthenticationError:
        return ChatResponse(
            reply="⚠️ Invalid API key. Please check your `ANTHROPIC_API_KEY`.",
            usage={},
        )
    except anthropic.RateLimitError:
        return ChatResponse(
            reply="⚠️ Rate limited by Claude API. Please wait a moment and try again.",
            usage={},
        )
    except Exception as e:
        logger.exception("Chat error")
        return ChatResponse(
            reply=f"⚠️ Error communicating with Claude: {str(e)}",
            usage={},
        )
