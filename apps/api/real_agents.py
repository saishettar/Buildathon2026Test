"""Real Claude-powered agent scenarios that make live API calls."""
from __future__ import annotations

import asyncio
import os
import uuid
import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic

from models import Run, Step, RunStatus, StepStatus, StepType, StepError
from database import db
from websocket_manager import manager

logger = logging.getLogger(__name__)

# Claude 3.5 Sonnet pricing per 1K tokens
CLAUDE_COST_PER_1K_PROMPT = 0.003
CLAUDE_COST_PER_1K_COMPLETION = 0.015
CLAUDE_MODEL = "claude-sonnet-4-20250514"


def _compute_claude_cost(input_tokens: int, output_tokens: int) -> float:
    return round(
        (input_tokens / 1000) * CLAUDE_COST_PER_1K_PROMPT
        + (output_tokens / 1000) * CLAUDE_COST_PER_1K_COMPLETION,
        6,
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _emit_step_start(
    run_id: str,
    name: str,
    step_type: StepType,
    parent_step_id: Optional[str],
    input_data: dict[str, Any],
) -> Step:
    """Create a step in 'running' state, store it, and broadcast."""
    step = Step(
        step_id=str(uuid.uuid4()),
        run_id=run_id,
        parent_step_id=parent_step_id,
        name=name,
        type=step_type,
        status=StepStatus.running,
        started_at=_now(),
        input=input_data,
    )
    db.create_step(step)
    await manager.broadcast(run_id, {
        "type": "step_update",
        "step": step.model_dump(),
    })
    return step


async def _complete_step(
    step: Step,
    output: dict[str, Any],
    tokens_prompt: int = 0,
    tokens_completion: int = 0,
    duration_ms: int = 0,
) -> Step:
    """Mark step completed with real data and broadcast."""
    step.status = StepStatus.completed
    step.ended_at = _now()
    step.duration_ms = duration_ms
    step.tokens_prompt = tokens_prompt
    step.tokens_completion = tokens_completion
    step.cost_usd = _compute_claude_cost(tokens_prompt, tokens_completion)
    step.output = output
    db.update_step(step)
    await manager.broadcast(step.run_id, {
        "type": "step_update",
        "step": step.model_dump(),
    })
    return step


async def _fail_step(step: Step, error_msg: str, duration_ms: int = 0) -> Step:
    """Mark step failed and broadcast."""
    step.status = StepStatus.failed
    step.ended_at = _now()
    step.duration_ms = duration_ms
    step.error = StepError(message=error_msg)
    db.update_step(step)
    await manager.broadcast(step.run_id, {
        "type": "step_update",
        "step": step.model_dump(),
    })
    return step


async def _call_claude(
    client: anthropic.Anthropic,
    system: str,
    user_prompt: str,
    max_tokens: int = 1024,
) -> tuple[str, int, int, int]:
    """Make a real Claude API call. Returns (text, input_tokens, output_tokens, duration_ms)."""
    t0 = time.monotonic()
    response = await asyncio.to_thread(
        client.messages.create,
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_prompt}],
    )
    duration_ms = int((time.monotonic() - t0) * 1000)
    text = response.content[0].text
    return text, response.usage.input_tokens, response.usage.output_tokens, duration_ms


async def _finish_run(run_id: str, status: RunStatus) -> None:
    """Update run status and broadcast."""
    run = db.get_run(run_id)
    if run:
        run.status = status
        run.updated_at = _now()
        db.update_run(run)
        await manager.broadcast(run_id, {
            "type": "run_update",
            "run": run.model_dump(),
        })


# ──────────────────────────────────────────────────────────────────────────────
# Scenario A: Hotel Research Agent
# ──────────────────────────────────────────────────────────────────────────────

async def run_hotel_research(run_id: str) -> None:
    """Real Claude-powered hotel research agent."""
    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

    try:
        # Step 1: Plan
        plan_prompt = (
            "You are a travel research agent. Create a plan to research hotels "
            "near Times Square NYC, compare prices, and recommend the best option. "
            "Output your plan as a numbered list."
        )
        step1 = await _emit_step_start(
            run_id, "Plan Hotel Research", StepType.plan, None,
            {"prompt": plan_prompt},
        )
        # Set root_step_id
        run = db.get_run(run_id)
        if run:
            run.root_step_id = step1.step_id
            db.update_run(run)
            await manager.broadcast(run_id, {"type": "run_update", "run": run.model_dump()})

        text, inp, out, dur = await _call_claude(
            client,
            "You are a meticulous travel research assistant.",
            plan_prompt,
        )
        await _complete_step(step1, {"plan": text}, inp, out, dur)

        # Step 2: Tool — web search (simulated via Claude)
        search_prompt = (
            "List 5 real hotels near Times Square NYC with realistic nightly rates, "
            "star ratings, and a one-line review for each. Format as a JSON array "
            "with fields: name, price_per_night, stars, review."
        )
        step2 = await _emit_step_start(
            run_id, "Search Hotels", StepType.tool, step1.step_id,
            {"tool": "web_search", "prompt": search_prompt},
        )
        text2, inp2, out2, dur2 = await _call_claude(
            client,
            "You are a hotel database. Return realistic hotel data as valid JSON.",
            search_prompt,
        )
        await _complete_step(step2, {"hotels": text2}, inp2, out2, dur2)

        # Step 3: LLM — compare hotels
        compare_prompt = (
            f"Here are hotels near Times Square:\n\n{text2}\n\n"
            "Compare these hotels. Rank them by value (price vs quality). "
            "Recommend the best option and explain why."
        )
        step3 = await _emit_step_start(
            run_id, "Compare & Rank Hotels", StepType.llm, step2.step_id,
            {"prompt": compare_prompt},
        )
        text3, inp3, out3, dur3 = await _call_claude(
            client,
            "You are a savvy travel advisor.",
            compare_prompt,
        )
        await _complete_step(step3, {"comparison": text3}, inp3, out3, dur3)

        # Step 4: Final — recommendation
        step4 = await _emit_step_start(
            run_id, "Final Recommendation", StepType.final, step3.step_id,
            {"summary": "Generating final recommendation"},
        )
        await _complete_step(step4, {"result": text3}, 0, 0, 50)

        await _finish_run(run_id, RunStatus.completed)
        logger.info(f"Hotel research completed for run {run_id}")

    except Exception as e:
        logger.exception(f"Hotel research failed: {e}")
        await _finish_run(run_id, RunStatus.failed)


# ──────────────────────────────────────────────────────────────────────────────
# Scenario B: Code Generator Agent
# ──────────────────────────────────────────────────────────────────────────────

async def run_code_generator(run_id: str) -> None:
    """Real Claude-powered code generator agent."""
    client = anthropic.Anthropic()

    try:
        # Step 1: Plan
        plan_prompt = (
            "Plan how to build a Tic Tac Toe game in Python for the terminal. "
            "Outline the classes, functions, and game loop you will create. "
            "Output a numbered plan."
        )
        step1 = await _emit_step_start(
            run_id, "Plan Tic Tac Toe", StepType.plan, None,
            {"prompt": plan_prompt},
        )
        run = db.get_run(run_id)
        if run:
            run.root_step_id = step1.step_id
            db.update_run(run)
            await manager.broadcast(run_id, {"type": "run_update", "run": run.model_dump()})

        text1, inp1, out1, dur1 = await _call_claude(
            client,
            "You are a senior Python developer planning a project.",
            plan_prompt,
        )
        await _complete_step(step1, {"plan": text1}, inp1, out1, dur1)

        # Step 2: LLM — write code
        code_prompt = (
            "Write the full Python code for a terminal-based Tic Tac Toe game. "
            "Include: a Board class, input validation, win/draw detection, "
            "and a main game loop. Output ONLY the Python code, no explanation."
        )
        step2 = await _emit_step_start(
            run_id, "Write Tic Tac Toe Code", StepType.llm, step1.step_id,
            {"prompt": code_prompt},
        )
        text2, inp2, out2, dur2 = await _call_claude(
            client,
            "You are an expert Python developer. Output only valid Python code.",
            code_prompt,
            max_tokens=2048,
        )
        await _complete_step(step2, {"code": text2}, inp2, out2, dur2)

        # Step 3: Tool — save file
        step3 = await _emit_step_start(
            run_id, "Save Code to File", StepType.tool, step2.step_id,
            {"tool": "write_file", "path": "apps/api/generated/tic_tac_toe.py"},
        )
        t0 = time.monotonic()
        try:
            # Extract code from markdown fences if present
            code_content = text2
            if "```python" in code_content:
                code_content = code_content.split("```python", 1)[1]
                code_content = code_content.split("```", 1)[0]
            elif "```" in code_content:
                code_content = code_content.split("```", 1)[1]
                code_content = code_content.split("```", 1)[0]

            gen_dir = os.path.join(os.path.dirname(__file__), "generated")
            os.makedirs(gen_dir, exist_ok=True)
            file_path = os.path.join(gen_dir, "tic_tac_toe.py")
            with open(file_path, "w") as f:
                f.write(code_content.strip() + "\n")
            save_dur = int((time.monotonic() - t0) * 1000)
            await _complete_step(
                step3,
                {"file_path": file_path, "bytes_written": len(code_content)},
                0, 0, save_dur,
            )
        except Exception as e:
            save_dur = int((time.monotonic() - t0) * 1000)
            await _fail_step(step3, f"Failed to save file: {e}", save_dur)
            await _finish_run(run_id, RunStatus.failed)
            return

        # Step 4: LLM — review code
        review_prompt = (
            f"Review this Python Tic Tac Toe code and suggest improvements:\n\n"
            f"{text2}\n\n"
            "Focus on: code quality, error handling, user experience, and any bugs."
        )
        step4 = await _emit_step_start(
            run_id, "Review Code", StepType.llm, step3.step_id,
            {"prompt": review_prompt},
        )
        text4, inp4, out4, dur4 = await _call_claude(
            client,
            "You are a senior code reviewer. Be specific and constructive.",
            review_prompt,
            max_tokens=1500,
        )
        await _complete_step(step4, {"review": text4}, inp4, out4, dur4)

        # Step 5: Final
        step5 = await _emit_step_start(
            run_id, "Final Summary", StepType.final, step4.step_id,
            {"summary": "Code generation and review complete"},
        )
        await _complete_step(step5, {"result": text4}, 0, 0, 30)

        await _finish_run(run_id, RunStatus.completed)
        logger.info(f"Code generator completed for run {run_id}")

    except Exception as e:
        logger.exception(f"Code generator failed: {e}")
        await _finish_run(run_id, RunStatus.failed)


# ──────────────────────────────────────────────────────────────────────────────
# Scenario C: Research & Summarize Agent
# ──────────────────────────────────────────────────────────────────────────────

async def run_research_summarize(run_id: str) -> None:
    """Real Claude-powered research & summarize agent with parallel branches."""
    client = anthropic.Anthropic()

    try:
        # Step 1: Plan
        plan_prompt = (
            "Plan how to research and summarize the latest developments in AI "
            "regulation. You will research US regulations and EU AI Act in parallel, "
            "then synthesize a comprehensive comparison. Output a numbered plan."
        )
        step1 = await _emit_step_start(
            run_id, "Plan AI Regulation Research", StepType.plan, None,
            {"prompt": plan_prompt},
        )
        run = db.get_run(run_id)
        if run:
            run.root_step_id = step1.step_id
            db.update_run(run)
            await manager.broadcast(run_id, {"type": "run_update", "run": run.model_dump()})

        text1, inp1, out1, dur1 = await _call_claude(
            client,
            "You are a policy research strategist.",
            plan_prompt,
        )
        await _complete_step(step1, {"plan": text1}, inp1, out1, dur1)

        # Step 2a & 2b: Parallel branches
        us_prompt = (
            "Provide a detailed summary of US AI regulation developments as of "
            "early 2026. Cover: Executive Orders, proposed legislation, FTC actions, "
            "NIST AI Risk Management Framework updates, and state-level laws."
        )
        eu_prompt = (
            "Provide a detailed summary of EU AI Act developments as of early 2026. "
            "Cover: risk classification tiers, compliance deadlines, enforcement "
            "mechanisms, impact on tech companies, and recent amendments."
        )

        # Start both steps as running
        step2a = await _emit_step_start(
            run_id, "Research US AI Regulation", StepType.tool, step1.step_id,
            {"tool": "web_search", "prompt": us_prompt},
        )
        step2b = await _emit_step_start(
            run_id, "Research EU AI Act", StepType.tool, step1.step_id,
            {"tool": "web_search", "prompt": eu_prompt},
        )

        # Run both Claude calls concurrently
        async def _do_us():
            return await _call_claude(
                client,
                "You are a US policy expert on AI regulation.",
                us_prompt,
                max_tokens=1500,
            )

        async def _do_eu():
            return await _call_claude(
                client,
                "You are an EU policy expert on the AI Act.",
                eu_prompt,
                max_tokens=1500,
            )

        (text2a, inp2a, out2a, dur2a), (text2b, inp2b, out2b, dur2b) = (
            await asyncio.gather(_do_us(), _do_eu())
        )

        await _complete_step(step2a, {"us_regulation": text2a}, inp2a, out2a, dur2a)
        await _complete_step(step2b, {"eu_regulation": text2b}, inp2b, out2b, dur2b)

        # Step 3: Synthesize — parent is step2a (frontend renders edges from both)
        synth_prompt = (
            f"## US AI Regulation Summary\n{text2a}\n\n"
            f"## EU AI Act Summary\n{text2b}\n\n"
            "Synthesize a comprehensive comparison of US vs EU approaches to AI "
            "regulation. Highlight key differences, common themes, and implications "
            "for global tech companies."
        )
        step3 = await _emit_step_start(
            run_id, "Synthesize US vs EU Comparison", StepType.llm, step2a.step_id,
            {"prompt": synth_prompt},
        )
        text3, inp3, out3, dur3 = await _call_claude(
            client,
            "You are a global policy analyst specializing in technology regulation.",
            synth_prompt,
            max_tokens=2048,
        )
        await _complete_step(step3, {"synthesis": text3}, inp3, out3, dur3)

        # Step 4: Final
        step4 = await _emit_step_start(
            run_id, "Final Report", StepType.final, step3.step_id,
            {"summary": "Research synthesis complete"},
        )
        await _complete_step(step4, {"result": text3}, 0, 0, 40)

        await _finish_run(run_id, RunStatus.completed)
        logger.info(f"Research & summarize completed for run {run_id}")

    except Exception as e:
        logger.exception(f"Research & summarize failed: {e}")
        await _finish_run(run_id, RunStatus.failed)


# ── Dispatcher ───────────────────────────────────────────────────────────────

REAL_SCENARIOS: dict[str, Any] = {
    "hotel_research": run_hotel_research,
    "code_generator": run_code_generator,
    "research_summarize": run_research_summarize,
}


async def run_real_agent(run_id: str, scenario: str) -> None:
    """Dispatch to the appropriate real agent scenario."""
    handler = REAL_SCENARIOS.get(scenario)
    if not handler:
        logger.error(f"Unknown real scenario: {scenario}")
        await _finish_run(run_id, RunStatus.failed)
        return
    await handler(run_id)
