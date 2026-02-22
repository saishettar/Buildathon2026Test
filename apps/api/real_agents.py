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


# ──────────────────────────────────────────────────────────────────────────────
# Scenario D: Deep Research & Fact-Check Agent
# ──────────────────────────────────────────────────────────────────────────────

async def run_deep_research(run_id: str) -> None:
    """Real Claude-powered multi-source fact-checking agent."""
    client = anthropic.Anthropic()
    claim = "The average software engineer salary in NYC has increased 15% since 2023"

    try:
        # Step 1: Plan
        plan_prompt = (
            f'You are a fact-checking research agent. A user claims: "{claim}". '
            "Plan a research strategy to verify this claim. Identify: which angles "
            "to verify, what data points to gather, and what sources to cross-reference. "
            "Output a numbered plan."
        )
        step1 = await _emit_step_start(
            run_id, "Plan Research Strategy", StepType.plan, None,
            {"claim": claim, "prompt": plan_prompt},
        )
        run = db.get_run(run_id)
        if run:
            run.root_step_id = step1.step_id
            db.update_run(run)
            await manager.broadcast(run_id, {"type": "run_update", "run": run.model_dump()})

        text1, inp1, out1, dur1 = await _call_claude(client, "You are a meticulous fact-checking researcher.", plan_prompt)
        await _complete_step(step1, {"plan": text1}, inp1, out1, dur1)

        # Step 2a, 2b, 2c: Parallel research branches
        salary_prompt = (
            f'Research salary data to evaluate this claim: "{claim}". '
            "Provide detailed data from tech industry compensation reports, "
            "levels.fyi-style data, and compensation trend analysis for NYC software engineers."
        )
        col_prompt = (
            f'Research the labor market context for this claim: "{claim}". '
            "Cover hiring freezes, layoff trends, remote work impact on NYC salaries, "
            "and cost of living adjustments since 2023."
        )
        method_prompt = (
            f'Analyze the methodology behind this claim: "{claim}". '
            "What does 'average' mean (mean vs median)? Which roles count as 'software engineer'? "
            "How could the 15% figure be calculated differently depending on methodology?"
        )

        step2a = await _emit_step_start(run_id, "Research Salary Data", StepType.tool, step1.step_id, {"tool": "research", "prompt": salary_prompt})
        step2b = await _emit_step_start(run_id, "Research Labor Market Context", StepType.tool, step1.step_id, {"tool": "research", "prompt": col_prompt})
        step2c = await _emit_step_start(run_id, "Analyze Methodology", StepType.tool, step1.step_id, {"tool": "research", "prompt": method_prompt})

        async def _r_salary():
            return await _call_claude(client, "You are a compensation data analyst.", salary_prompt, max_tokens=1500)
        async def _r_context():
            return await _call_claude(client, "You are a labor market economist.", col_prompt, max_tokens=1500)
        async def _r_method():
            return await _call_claude(client, "You are a research methodology expert.", method_prompt, max_tokens=1500)

        (t2a, i2a, o2a, d2a), (t2b, i2b, o2b, d2b), (t2c, i2c, o2c, d2c) = await asyncio.gather(_r_salary(), _r_context(), _r_method())

        await _complete_step(step2a, {"salary_data": t2a}, i2a, o2a, d2a)
        await _complete_step(step2b, {"market_context": t2b}, i2b, o2b, d2b)
        await _complete_step(step2c, {"methodology": t2c}, i2c, o2c, d2c)

        # Step 3: Synthesize
        synth_prompt = (
            f"## Salary Data\n{t2a}\n\n## Labor Market Context\n{t2b}\n\n## Methodology Analysis\n{t2c}\n\n"
            "Synthesize all three research branches. Identify where sources agree and conflict. Flag any data gaps."
        )
        step3 = await _emit_step_start(run_id, "Synthesize Findings", StepType.llm, step2a.step_id, {"prompt": synth_prompt})
        text3, inp3, out3, dur3 = await _call_claude(client, "You are a senior research analyst synthesizing multi-source findings.", synth_prompt, max_tokens=2048)
        await _complete_step(step3, {"synthesis": text3}, inp3, out3, dur3)

        # Step 4: Verdict
        verdict_prompt = (
            f'Based on this synthesis:\n\n{text3}\n\n'
            f'Deliver a final verdict on the claim: "{claim}". '
            "State: Confirmed, Partially True, Misleading, or False. "
            "Include a confidence level (percentage) and a detailed evidence summary explaining the nuance."
        )
        step4 = await _emit_step_start(run_id, "Deliver Verdict", StepType.llm, step3.step_id, {"prompt": verdict_prompt})
        text4, inp4, out4, dur4 = await _call_claude(client, "You are an authoritative fact-checker delivering a final verdict.", verdict_prompt, max_tokens=1500)
        await _complete_step(step4, {"verdict": text4}, inp4, out4, dur4)

        # Step 5: Final
        step5 = await _emit_step_start(run_id, "Fact-Check Report", StepType.final, step4.step_id, {"summary": "Fact-check complete"})
        await _complete_step(step5, {"result": text4}, 0, 0, 30)

        await _finish_run(run_id, RunStatus.completed)
        logger.info(f"Deep research completed for run {run_id}")
    except Exception as e:
        logger.exception(f"Deep research failed: {e}")
        await _finish_run(run_id, RunStatus.failed)


# ──────────────────────────────────────────────────────────────────────────────
# Scenario E: API Integration Planner Agent
# ──────────────────────────────────────────────────────────────────────────────

async def run_api_integration(run_id: str) -> None:
    """Real Claude-powered API integration planner agent."""
    client = anthropic.Anthropic()
    task = "Connect Stripe payments to a PostgreSQL order database with webhook handling"

    try:
        # Step 1: Plan
        plan_prompt = (
            f'You are an API integration architect. Task: "{task}". '
            "Analyze the integration requirements: APIs involved, authentication flows, "
            "data mapping needs, and error handling considerations. Output a numbered plan."
        )
        step1 = await _emit_step_start(run_id, "Analyze Integration Requirements", StepType.plan, None, {"task": task, "prompt": plan_prompt})
        run = db.get_run(run_id)
        if run:
            run.root_step_id = step1.step_id
            db.update_run(run)
            await manager.broadcast(run_id, {"type": "run_update", "run": run.model_dump()})

        text1, inp1, out1, dur1 = await _call_claude(client, "You are a senior backend architect specializing in API integrations.", plan_prompt)
        await _complete_step(step1, {"plan": text1}, inp1, out1, dur1)

        # Step 2: Data flow design
        flow_prompt = (
            f"Based on this plan:\n\n{text1}\n\n"
            "Design the data flow: what Stripe events trigger what actions, "
            "what data transforms are needed between Stripe's webhook payload schema "
            "and the Postgres order table schema, and what the retry/idempotency strategy should be."
        )
        step2 = await _emit_step_start(run_id, "Design Data Flow", StepType.llm, step1.step_id, {"prompt": flow_prompt})
        text2, inp2, out2, dur2 = await _call_claude(client, "You are a data architecture expert.", flow_prompt, max_tokens=1500)
        await _complete_step(step2, {"data_flow": text2}, inp2, out2, dur2)

        # Step 3a, 3b: Parallel code generation
        webhook_prompt = (
            f"Based on this data flow design:\n\n{text2}\n\n"
            "Generate a complete FastAPI webhook handler that receives Stripe webhooks, "
            "validates signatures, and processes payment events (payment_intent.succeeded, "
            "charge.refunded, etc.). Include proper error handling and idempotency. "
            "Output only Python code."
        )
        db_prompt = (
            f"Based on this data flow design:\n\n{text2}\n\n"
            "Generate the database layer: SQLAlchemy models for orders, a migration script, "
            "and query functions for CRUD operations on the order table. "
            "Include proper indexing and constraints. Output only Python code."
        )

        step3a = await _emit_step_start(run_id, "Generate Webhook Handler", StepType.tool, step2.step_id, {"tool": "code_gen", "prompt": webhook_prompt})
        step3b = await _emit_step_start(run_id, "Generate Database Layer", StepType.tool, step2.step_id, {"tool": "code_gen", "prompt": db_prompt})

        async def _gen_webhook():
            return await _call_claude(client, "You are an expert Python developer. Output only valid Python code.", webhook_prompt, max_tokens=2048)
        async def _gen_db():
            return await _call_claude(client, "You are an expert Python developer. Output only valid Python code.", db_prompt, max_tokens=2048)

        (t3a, i3a, o3a, d3a), (t3b, i3b, o3b, d3b) = await asyncio.gather(_gen_webhook(), _gen_db())

        await _complete_step(step3a, {"webhook_code": t3a}, i3a, o3a, d3a)
        await _complete_step(step3b, {"database_code": t3b}, i3b, o3b, d3b)

        # Step 4: Review consistency
        review_prompt = (
            f"## Webhook Handler\n{t3a}\n\n## Database Layer\n{t3b}\n\n"
            "Review both components for consistency: field names match, error handling aligned, "
            "no gaps in data flow. Identify any issues."
        )
        step4 = await _emit_step_start(run_id, "Review Consistency", StepType.llm, step3a.step_id, {"prompt": review_prompt})
        text4, inp4, out4, dur4 = await _call_claude(client, "You are a senior code reviewer.", review_prompt, max_tokens=1500)
        await _complete_step(step4, {"review": text4}, inp4, out4, dur4)

        # Step 5: Save files
        step5 = await _emit_step_start(run_id, "Save Generated Code", StepType.tool, step4.step_id, {"tool": "write_files"})
        t0 = time.monotonic()
        try:
            gen_dir = os.path.join(os.path.dirname(__file__), "generated", "stripe_integration")
            os.makedirs(gen_dir, exist_ok=True)
            def _extract(raw: str) -> str:
                if "```python" in raw:
                    raw = raw.split("```python", 1)[1].split("```", 1)[0]
                elif "```" in raw:
                    raw = raw.split("```", 1)[1].split("```", 1)[0]
                return raw.strip() + "\n"
            with open(os.path.join(gen_dir, "webhook_handler.py"), "w") as f:
                f.write(_extract(t3a))
            with open(os.path.join(gen_dir, "database.py"), "w") as f:
                f.write(_extract(t3b))
            dur5 = int((time.monotonic() - t0) * 1000)
            await _complete_step(step5, {"files": ["webhook_handler.py", "database.py"], "directory": gen_dir}, 0, 0, dur5)
        except Exception as e:
            dur5 = int((time.monotonic() - t0) * 1000)
            await _fail_step(step5, f"Failed to save files: {e}", dur5)
            await _finish_run(run_id, RunStatus.failed)
            return

        # Step 6: Deployment checklist
        checklist_prompt = (
            f"Based on this integration (webhook handler + database layer):\n\n{text4}\n\n"
            "Produce a deployment checklist: environment variables needed, Stripe dashboard config, "
            "database setup steps, and testing strategy with Stripe's test mode."
        )
        step6 = await _emit_step_start(run_id, "Deployment Checklist", StepType.llm, step5.step_id, {"prompt": checklist_prompt})
        text6, inp6, out6, dur6 = await _call_claude(client, "You are a DevOps engineer.", checklist_prompt, max_tokens=1500)
        await _complete_step(step6, {"checklist": text6}, inp6, out6, dur6)

        # Step 7: Final
        step7 = await _emit_step_start(run_id, "Integration Plan Complete", StepType.final, step6.step_id, {"summary": "API integration plan complete"})
        await _complete_step(step7, {"result": text6}, 0, 0, 30)

        await _finish_run(run_id, RunStatus.completed)
        logger.info(f"API integration completed for run {run_id}")
    except Exception as e:
        logger.exception(f"API integration failed: {e}")
        await _finish_run(run_id, RunStatus.failed)


# ──────────────────────────────────────────────────────────────────────────────
# Scenario F: Incident Response Agent
# ──────────────────────────────────────────────────────────────────────────────

async def run_incident_response(run_id: str) -> None:
    """Real Claude-powered incident response agent."""
    client = anthropic.Anthropic()
    alert = "API response times spiked to 12s average, error rate jumped to 23%, affecting /api/orders endpoint"

    try:
        # Step 1: Plan / Triage
        plan_prompt = (
            f'You are an SRE incident commander. Alert received: "{alert}". '
            "Create a triage plan: what to check first, likely causes ranked by probability, "
            "and how to prioritize investigation. Output a numbered plan."
        )
        step1 = await _emit_step_start(run_id, "Triage & Plan", StepType.plan, None, {"alert": alert, "prompt": plan_prompt})
        run = db.get_run(run_id)
        if run:
            run.root_step_id = step1.step_id
            db.update_run(run)
            await manager.broadcast(run_id, {"type": "run_update", "run": run.model_dump()})

        text1, inp1, out1, dur1 = await _call_claude(client, "You are a senior SRE with 10 years of incident response experience.", plan_prompt)
        await _complete_step(step1, {"plan": text1}, inp1, out1, dur1)

        # Step 2a, 2b, 2c: Parallel investigation
        infra_prompt = (
            f'Alert: "{alert}". Analyze from an infrastructure perspective. '
            "What would cause latency spikes: database connection pool exhaustion, memory leak, "
            "CPU saturation, network issues? Provide diagnostic commands and expected findings."
        )
        app_prompt = (
            f'Alert: "{alert}". Analyze from an application perspective. '
            "What could cause errors on /api/orders specifically: bad deployment, upstream dependency "
            "failure, data corruption, query regression? Include code-level investigation steps."
        )
        corr_prompt = (
            f'Alert: "{alert}". Check for correlating signals. '
            "Was there a recent deployment? Did traffic spike? Are other endpoints affected? "
            "Any upstream provider outages? Construct a timeline of events."
        )

        step2a = await _emit_step_start(run_id, "Investigate Infrastructure", StepType.tool, step1.step_id, {"tool": "diagnostics", "prompt": infra_prompt})
        step2b = await _emit_step_start(run_id, "Investigate Application", StepType.tool, step1.step_id, {"tool": "diagnostics", "prompt": app_prompt})
        step2c = await _emit_step_start(run_id, "Check Correlating Signals", StepType.tool, step1.step_id, {"tool": "diagnostics", "prompt": corr_prompt})

        async def _infra():
            return await _call_claude(client, "You are an infrastructure engineer diagnosing a production incident.", infra_prompt, max_tokens=1500)
        async def _app():
            return await _call_claude(client, "You are a backend engineer investigating application errors.", app_prompt, max_tokens=1500)
        async def _corr():
            return await _call_claude(client, "You are an SRE correlating incident signals.", corr_prompt, max_tokens=1500)

        (t2a, i2a, o2a, d2a), (t2b, i2b, o2b, d2b), (t2c, i2c, o2c, d2c) = await asyncio.gather(_infra(), _app(), _corr())

        await _complete_step(step2a, {"infrastructure": t2a}, i2a, o2a, d2a)
        await _complete_step(step2b, {"application": t2b}, i2b, o2b, d2b)
        await _complete_step(step2c, {"correlations": t2c}, i2c, o2c, d2c)

        # Step 3: Root cause & mitigation
        rca_prompt = (
            f"## Infrastructure Analysis\n{t2a}\n\n## Application Analysis\n{t2b}\n\n"
            f"## Correlating Signals\n{t2c}\n\n"
            "Synthesize the investigation. Narrow down to the most likely root cause with reasoning. "
            "Propose immediate mitigation steps vs longer-term fix."
        )
        step3 = await _emit_step_start(run_id, "Root Cause Analysis", StepType.llm, step2a.step_id, {"prompt": rca_prompt})
        text3, inp3, out3, dur3 = await _call_claude(client, "You are a principal engineer performing root cause analysis.", rca_prompt, max_tokens=2048)
        await _complete_step(step3, {"root_cause": text3}, inp3, out3, dur3)

        # Step 4: Communications
        comms_prompt = (
            f"Based on this root cause analysis:\n\n{text3}\n\n"
            "Draft two communications: 1) A status page update for customers (professional, "
            "transparent, non-technical). 2) An internal Slack message for the engineering team "
            "with current status, impact, and ETA."
        )
        step4 = await _emit_step_start(run_id, "Draft Communications", StepType.llm, step3.step_id, {"prompt": comms_prompt})
        text4, inp4, out4, dur4 = await _call_claude(client, "You are an incident communications specialist.", comms_prompt, max_tokens=1500)
        await _complete_step(step4, {"communications": text4}, inp4, out4, dur4)

        # Step 5: Post-incident review
        pir_prompt = (
            f"Based on all findings:\n\nRoot Cause: {text3}\n\nCommunications: {text4}\n\n"
            "Write a post-incident review: timeline, root cause, impact metrics, "
            "action items to prevent recurrence, and lessons learned."
        )
        step5 = await _emit_step_start(run_id, "Post-Incident Review", StepType.llm, step4.step_id, {"prompt": pir_prompt})
        text5, inp5, out5, dur5 = await _call_claude(client, "You are writing a blameless post-incident review.", pir_prompt, max_tokens=2048)
        await _complete_step(step5, {"review": text5}, inp5, out5, dur5)

        # Step 6: Final
        step6 = await _emit_step_start(run_id, "Incident Response Package", StepType.final, step5.step_id, {"summary": "Incident response complete"})
        await _complete_step(step6, {"result": text5}, 0, 0, 30)

        await _finish_run(run_id, RunStatus.completed)
        logger.info(f"Incident response completed for run {run_id}")
    except Exception as e:
        logger.exception(f"Incident response failed: {e}")
        await _finish_run(run_id, RunStatus.failed)


# ──────────────────────────────────────────────────────────────────────────────
# Scenario G: Database Query Optimizer Agent
# ──────────────────────────────────────────────────────────────────────────────

SLOW_QUERY = """SELECT u.*, o.*, p.* FROM users u
LEFT JOIN orders o ON u.id = o.user_id
LEFT JOIN products p ON o.product_id = p.id
WHERE u.created_at > '2024-01-01'
AND o.status IN ('completed', 'shipped')
AND p.category = 'electronics'
ORDER BY o.created_at DESC;"""

QUERY_CONTEXT = (
    "Table sizes: users: 2M rows, orders: 15M rows, products: 50K rows. "
    "This query currently takes 45 seconds."
)


async def run_query_optimizer(run_id: str) -> None:
    """Real Claude-powered SQL query optimizer agent."""
    client = anthropic.Anthropic()

    try:
        # Step 1: Plan
        plan_prompt = (
            f"You are a database performance expert. Optimize this slow query:\n\n"
            f"```sql\n{SLOW_QUERY}\n```\n\n{QUERY_CONTEXT}\n\n"
            "Plan your optimization approach: analyze the query structure, identify obvious problems, "
            "plan what indexes and rewrites to consider. Output a numbered plan."
        )
        step1 = await _emit_step_start(run_id, "Plan Optimization", StepType.plan, None, {"query": SLOW_QUERY, "context": QUERY_CONTEXT})
        run = db.get_run(run_id)
        if run:
            run.root_step_id = step1.step_id
            db.update_run(run)
            await manager.broadcast(run_id, {"type": "run_update", "run": run.model_dump()})

        text1, inp1, out1, dur1 = await _call_claude(client, "You are a PostgreSQL performance tuning expert.", plan_prompt)
        await _complete_step(step1, {"plan": text1}, inp1, out1, dur1)

        # Step 2: Analyze query issues
        analyze_prompt = (
            f"Analyze this query in detail:\n\n```sql\n{SLOW_QUERY}\n```\n\n{QUERY_CONTEXT}\n\n"
            "Identify all issues: SELECT *, join order inefficiency, missing indexes, "
            "LEFT JOINs that should be INNER JOINs given the WHERE clauses, and any other problems."
        )
        step2 = await _emit_step_start(run_id, "Analyze Query Issues", StepType.llm, step1.step_id, {"prompt": analyze_prompt})
        text2, inp2, out2, dur2 = await _call_claude(client, "You are a senior DBA analyzing a slow query.", analyze_prompt, max_tokens=1500)
        await _complete_step(step2, {"analysis": text2}, inp2, out2, dur2)

        # Step 3: EXPLAIN ANALYZE prediction
        explain_prompt = (
            f"Based on this analysis:\n\n{text2}\n\n"
            f"Query:\n```sql\n{SLOW_QUERY}\n```\n\n{QUERY_CONTEXT}\n\n"
            "Generate an EXPLAIN ANALYZE prediction: what the query planner is likely doing "
            "(sequential scans, hash joins vs nested loops) and where the bottlenecks are."
        )
        step3 = await _emit_step_start(run_id, "Predict Execution Plan", StepType.llm, step2.step_id, {"prompt": explain_prompt})
        text3, inp3, out3, dur3 = await _call_claude(client, "You are a PostgreSQL internals expert.", explain_prompt, max_tokens=1500)
        await _complete_step(step3, {"execution_plan": text3}, inp3, out3, dur3)

        # Step 4a, 4b: Parallel — rewrite query + generate indexes
        rewrite_prompt = (
            f"Based on this analysis:\n\n{text2}\n\nExecution plan:\n\n{text3}\n\n"
            "Rewrite the query with: optimized joins (INNER instead of LEFT where appropriate), "
            "specific column selection instead of *, proper filtering order, and any CTEs if helpful. "
            "Output only the optimized SQL query."
        )
        index_prompt = (
            f"Based on this analysis:\n\n{text2}\n\nExecution plan:\n\n{text3}\n\n"
            "Generate CREATE INDEX statements to support the optimized query. "
            "Include composite indexes where appropriate. Explain each index."
        )

        step4a = await _emit_step_start(run_id, "Rewrite Query", StepType.tool, step3.step_id, {"tool": "query_rewrite", "prompt": rewrite_prompt})
        step4b = await _emit_step_start(run_id, "Generate Indexes", StepType.tool, step3.step_id, {"tool": "index_gen", "prompt": index_prompt})

        async def _rewrite():
            return await _call_claude(client, "You are a SQL optimization expert. Output clean SQL.", rewrite_prompt, max_tokens=1500)
        async def _indexes():
            return await _call_claude(client, "You are a database indexing expert.", index_prompt, max_tokens=1500)

        (t4a, i4a, o4a, d4a), (t4b, i4b, o4b, d4b) = await asyncio.gather(_rewrite(), _indexes())

        await _complete_step(step4a, {"optimized_query": t4a}, i4a, o4a, d4a)
        await _complete_step(step4b, {"indexes": t4b}, i4b, o4b, d4b)

        # Step 5: Estimate improvement
        estimate_prompt = (
            f"Original query takes 45 seconds.\n\nOptimized query:\n{t4a}\n\nNew indexes:\n{t4b}\n\n"
            "Estimate the performance improvement: predicted execution time, memory usage, "
            "and explain exactly why each change helps."
        )
        step5 = await _emit_step_start(run_id, "Estimate Improvement", StepType.llm, step4a.step_id, {"prompt": estimate_prompt})
        text5, inp5, out5, dur5 = await _call_claude(client, "You are a database performance analyst.", estimate_prompt, max_tokens=1500)
        await _complete_step(step5, {"estimate": text5}, inp5, out5, dur5)

        # Step 6: Save SQL file
        step6 = await _emit_step_start(run_id, "Save Optimized SQL", StepType.tool, step5.step_id, {"tool": "write_file"})
        t0 = time.monotonic()
        try:
            gen_dir = os.path.join(os.path.dirname(__file__), "generated")
            os.makedirs(gen_dir, exist_ok=True)
            sql_content = f"-- Original query (45s):\n{SLOW_QUERY}\n\n-- Optimized query:\n{t4a}\n\n-- Indexes:\n{t4b}\n"
            with open(os.path.join(gen_dir, "optimized_query.sql"), "w") as f:
                f.write(sql_content)
            dur6 = int((time.monotonic() - t0) * 1000)
            await _complete_step(step6, {"file": "optimized_query.sql"}, 0, 0, dur6)
        except Exception as e:
            dur6 = int((time.monotonic() - t0) * 1000)
            await _fail_step(step6, f"Failed to save file: {e}", dur6)
            await _finish_run(run_id, RunStatus.failed)
            return

        # Step 7: Final
        step7 = await _emit_step_start(run_id, "Optimization Report", StepType.final, step6.step_id, {"summary": "Query optimization complete"})
        await _complete_step(step7, {"result": text5}, 0, 0, 30)

        await _finish_run(run_id, RunStatus.completed)
        logger.info(f"Query optimizer completed for run {run_id}")
    except Exception as e:
        logger.exception(f"Query optimizer failed: {e}")
        await _finish_run(run_id, RunStatus.failed)


# ──────────────────────────────────────────────────────────────────────────────
# Scenario H: Microservice Decomposition Agent
# ──────────────────────────────────────────────────────────────────────────────

MONOLITH_DESC = (
    "A monolithic e-commerce platform built with Django and a single PostgreSQL database. "
    "It handles: user authentication & profiles, product catalog & search, inventory management, "
    "order processing, payment processing (Stripe), shipping & fulfillment, "
    "email/SMS notifications, and analytics/reporting. The codebase is 150K lines, "
    "deployed as a single container, with a team of 25 engineers."
)


async def run_microservice_decomposition(run_id: str) -> None:
    """Real Claude-powered microservice decomposition agent."""
    client = anthropic.Anthropic()

    try:
        # Step 1: Plan
        plan_prompt = (
            f"You are a software architect. A company wants to decompose this monolith:\n\n"
            f"{MONOLITH_DESC}\n\n"
            "Plan the decomposition: principles to follow (bounded contexts, data ownership), "
            "what to analyze, and what deliverables to produce. Output a numbered plan."
        )
        step1 = await _emit_step_start(run_id, "Plan Decomposition", StepType.plan, None, {"monolith": MONOLITH_DESC})
        run = db.get_run(run_id)
        if run:
            run.root_step_id = step1.step_id
            db.update_run(run)
            await manager.broadcast(run_id, {"type": "run_update", "run": run.model_dump()})

        text1, inp1, out1, dur1 = await _call_claude(client, "You are a principal architect specializing in microservice migrations.", plan_prompt)
        await _complete_step(step1, {"plan": text1}, inp1, out1, dur1)

        # Step 2: Identify bounded contexts
        bc_prompt = (
            f"Monolith description:\n{MONOLITH_DESC}\n\nPlan:\n{text1}\n\n"
            "Identify the bounded contexts: which pieces of functionality should be grouped "
            "together and which separated, based on data coupling, team ownership, and deployment frequency."
        )
        step2 = await _emit_step_start(run_id, "Identify Bounded Contexts", StepType.llm, step1.step_id, {"prompt": bc_prompt})
        text2, inp2, out2, dur2 = await _call_claude(client, "You are a domain-driven design expert.", bc_prompt, max_tokens=1500)
        await _complete_step(step2, {"bounded_contexts": text2}, inp2, out2, dur2)

        # Step 3a, 3b, 3c: Parallel deep dives
        api_prompt = (
            f"Based on these bounded contexts:\n{text2}\n\n"
            "Design the service boundaries and APIs: what each microservice owns, "
            "its REST/gRPC endpoints, and its database schema. Be specific."
        )
        comm_prompt = (
            f"Based on these bounded contexts:\n{text2}\n\n"
            "Map the inter-service communication: which services talk to each other, "
            "sync vs async, what events to publish on a message bus. Include a message catalog."
        )
        risk_prompt = (
            f"Based on these bounded contexts:\n{text2}\n\n"
            "Identify migration risks: what breaks during decomposition, data consistency "
            "challenges (distributed transactions), and what order to extract services in."
        )

        step3a = await _emit_step_start(run_id, "Design Service APIs", StepType.tool, step2.step_id, {"tool": "architecture", "prompt": api_prompt})
        step3b = await _emit_step_start(run_id, "Map Communication", StepType.tool, step2.step_id, {"tool": "architecture", "prompt": comm_prompt})
        step3c = await _emit_step_start(run_id, "Identify Risks", StepType.tool, step2.step_id, {"tool": "risk_analysis", "prompt": risk_prompt})

        async def _apis():
            return await _call_claude(client, "You are a microservice API designer.", api_prompt, max_tokens=2048)
        async def _comms():
            return await _call_claude(client, "You are a distributed systems communication expert.", comm_prompt, max_tokens=2048)
        async def _risks():
            return await _call_claude(client, "You are a migration risk analyst.", risk_prompt, max_tokens=2048)

        (t3a, i3a, o3a, d3a), (t3b, i3b, o3b, d3b), (t3c, i3c, o3c, d3c) = await asyncio.gather(_apis(), _comms(), _risks())

        await _complete_step(step3a, {"service_apis": t3a}, i3a, o3a, d3a)
        await _complete_step(step3b, {"communication": t3b}, i3b, o3b, d3b)
        await _complete_step(step3c, {"risks": t3c}, i3c, o3c, d3c)

        # Step 4: Phased migration plan
        phase_prompt = (
            f"## Service APIs\n{t3a}\n\n## Communication\n{t3b}\n\n## Risks\n{t3c}\n\n"
            "Synthesize into a phased migration plan: phase 1 extract what, phase 2 extract what, etc. "
            "Include estimated effort and risk for each phase."
        )
        step4 = await _emit_step_start(run_id, "Phased Migration Plan", StepType.llm, step3a.step_id, {"prompt": phase_prompt})
        text4, inp4, out4, dur4 = await _call_claude(client, "You are a migration program manager.", phase_prompt, max_tokens=2048)
        await _complete_step(step4, {"migration_plan": text4}, inp4, out4, dur4)

        # Step 5: Generate Mermaid diagram
        diagram_prompt = (
            f"Based on this architecture:\n\n{t3a}\n\n{t3b}\n\n"
            "Generate a Mermaid architecture diagram showing all services, their databases, "
            "and the message bus connections. Output only the Mermaid diagram code."
        )
        step5 = await _emit_step_start(run_id, "Generate Architecture Diagram", StepType.tool, step4.step_id, {"tool": "diagram_gen"})
        text5, inp5, out5, dur5 = await _call_claude(client, "You are a technical diagram expert. Output only valid Mermaid syntax.", diagram_prompt, max_tokens=1500)

        t0 = time.monotonic()
        try:
            gen_dir = os.path.join(os.path.dirname(__file__), "generated")
            os.makedirs(gen_dir, exist_ok=True)
            mmd_content = text5
            if "```mermaid" in mmd_content:
                mmd_content = mmd_content.split("```mermaid", 1)[1].split("```", 1)[0]
            elif "```" in mmd_content:
                mmd_content = mmd_content.split("```", 1)[1].split("```", 1)[0]
            with open(os.path.join(gen_dir, "microservice_architecture.mmd"), "w") as f:
                f.write(mmd_content.strip() + "\n")
            write_dur = int((time.monotonic() - t0) * 1000)
            await _complete_step(step5, {"diagram": text5, "file": "microservice_architecture.mmd"}, inp5, out5, dur5 + write_dur)
        except Exception as e:
            await _complete_step(step5, {"diagram": text5}, inp5, out5, dur5)

        # Step 6: Infrastructure cost estimates
        cost_prompt = (
            f"Based on this migration plan:\n\n{text4}\n\n"
            "Produce infrastructure cost estimates: how many containers per service, "
            "what managed services (RDS, SQS/Kafka, API Gateway), "
            "and estimated monthly AWS cost compared to running the monolith."
        )
        step6 = await _emit_step_start(run_id, "Cost Estimates", StepType.llm, step5.step_id, {"prompt": cost_prompt})
        text6, inp6, out6, dur6 = await _call_claude(client, "You are a cloud infrastructure cost analyst.", cost_prompt, max_tokens=1500)
        await _complete_step(step6, {"cost_estimates": text6}, inp6, out6, dur6)

        # Step 7: Final
        step7 = await _emit_step_start(run_id, "Decomposition Proposal", StepType.final, step6.step_id, {"summary": "Decomposition complete"})
        await _complete_step(step7, {"result": text6}, 0, 0, 30)

        await _finish_run(run_id, RunStatus.completed)
        logger.info(f"Microservice decomposition completed for run {run_id}")
    except Exception as e:
        logger.exception(f"Microservice decomposition failed: {e}")
        await _finish_run(run_id, RunStatus.failed)


# ──────────────────────────────────────────────────────────────────────────────
# Scenario I: Contract Analyzer Agent
# ──────────────────────────────────────────────────────────────────────────────

SAMPLE_CONTRACT = """
SAAS SERVICE AGREEMENT

1. TERM & RENEWAL: This Agreement is for an initial term of 12 months and shall
automatically renew for successive 12-month periods unless either party provides
written notice of non-renewal at least 90 days prior to the end of the then-current
term. Early termination requires payment of 75% of remaining contract value.

2. FEES: Customer shall pay $2,400/month ($28,800/year). Provider may increase
fees by up to 15% upon renewal with 30 days notice. Late payments accrue interest
at 1.5% per month.

3. SERVICE LEVEL AGREEMENT: Provider targets 99.5% monthly uptime, measured
excluding scheduled maintenance windows (up to 8 hours/month). Service credits
are limited to 5% of monthly fees for each full hour of downtime beyond the target.
Maximum credit per month: 25% of monthly fees.

4. DATA PROCESSING: Customer data is processed in Provider's multi-tenant cloud
environment. Provider may use anonymized/aggregated Customer data for service
improvement and benchmarking. Upon termination, Customer has 30 days to export
data before deletion. Provider subprocesses data through third parties at its discretion.

5. LIABILITY: Provider's total aggregate liability shall not exceed fees paid in the
3 months preceding the claim. Provider is not liable for indirect, consequential,
or punitive damages. This limitation applies regardless of the form of action.

6. INDEMNIFICATION: Customer shall indemnify Provider against all claims arising
from Customer's use of the Service, including legal fees. Provider's indemnification
of Customer is limited to IP infringement claims only.

7. TERMINATION FOR CAUSE: Either party may terminate for material breach with
60 days written notice and cure period. However, Provider may suspend service
immediately for any payment default exceeding 15 days.

8. GOVERNING LAW: This Agreement is governed by the laws of Delaware. Any
disputes shall be resolved through binding arbitration in Wilmington, DE.
"""


async def run_contract_analyzer(run_id: str) -> None:
    """Real Claude-powered contract analysis agent."""
    client = anthropic.Anthropic()

    try:
        # Step 1: Plan
        plan_prompt = (
            "You are a SaaS contract analyst. Plan your analysis of this vendor agreement:\n\n"
            f"{SAMPLE_CONTRACT}\n\n"
            "What sections to scrutinize, what red flags to look for, "
            "what industry standards to compare against. Output a numbered plan."
        )
        step1 = await _emit_step_start(run_id, "Plan Contract Analysis", StepType.plan, None, {"contract_excerpt": SAMPLE_CONTRACT[:200] + "..."})
        run = db.get_run(run_id)
        if run:
            run.root_step_id = step1.step_id
            db.update_run(run)
            await manager.broadcast(run_id, {"type": "run_update", "run": run.model_dump()})

        text1, inp1, out1, dur1 = await _call_claude(client, "You are a corporate attorney specializing in SaaS agreements.", plan_prompt)
        await _complete_step(step1, {"plan": text1}, inp1, out1, dur1)

        # Step 2a, 2b, 2c: Parallel analysis
        financial_prompt = (
            f"Analyze the financial terms of this contract:\n\n{SAMPLE_CONTRACT}\n\n"
            "Cover: pricing structure, auto-renewal traps, termination penalties, hidden fees, "
            "and how they compare to market norms for SaaS agreements."
        )
        data_prompt = (
            f"Analyze the data and security terms of this contract:\n\n{SAMPLE_CONTRACT}\n\n"
            "Cover: data ownership, processing obligations, breach notification gaps, "
            "GDPR/SOC2 compliance gaps, and subprocessor transparency."
        )
        liability_prompt = (
            f"Analyze the liability and SLA terms of this contract:\n\n{SAMPLE_CONTRACT}\n\n"
            "Cover: uptime guarantees (99.5% vs industry 99.9%), credit calculations, "
            "liability caps (3 months is low), indemnification imbalance, and force majeure."
        )

        step2a = await _emit_step_start(run_id, "Analyze Financial Terms", StepType.tool, step1.step_id, {"tool": "analysis"})
        step2b = await _emit_step_start(run_id, "Analyze Data & Security", StepType.tool, step1.step_id, {"tool": "analysis"})
        step2c = await _emit_step_start(run_id, "Analyze Liability & SLA", StepType.tool, step1.step_id, {"tool": "analysis"})

        async def _fin():
            return await _call_claude(client, "You are a commercial finance attorney.", financial_prompt, max_tokens=1500)
        async def _data():
            return await _call_claude(client, "You are a data privacy attorney.", data_prompt, max_tokens=1500)
        async def _liab():
            return await _call_claude(client, "You are a corporate liability attorney.", liability_prompt, max_tokens=1500)

        (t2a, i2a, o2a, d2a), (t2b, i2b, o2b, d2b), (t2c, i2c, o2c, d2c) = await asyncio.gather(_fin(), _data(), _liab())

        await _complete_step(step2a, {"financial_analysis": t2a}, i2a, o2a, d2a)
        await _complete_step(step2b, {"data_analysis": t2b}, i2b, o2b, d2b)
        await _complete_step(step2c, {"liability_analysis": t2c}, i2c, o2c, d2c)

        # Step 3: Risk-rated summary
        risk_prompt_text = (
            f"## Financial Analysis\n{t2a}\n\n## Data & Security\n{t2b}\n\n## Liability & SLA\n{t2c}\n\n"
            "Compile all findings into a risk-rated summary. Flag each issue as Critical, High, "
            "Medium, or Low risk with specific clause references from the contract."
        )
        step3 = await _emit_step_start(run_id, "Risk-Rated Summary", StepType.llm, step2a.step_id, {"prompt": risk_prompt_text})
        text3, inp3, out3, dur3 = await _call_claude(client, "You are a risk assessment specialist.", risk_prompt_text, max_tokens=2048)
        await _complete_step(step3, {"risk_summary": text3}, inp3, out3, dur3)

        # Step 4: Redline suggestions
        redline_prompt = (
            f"Based on this risk assessment:\n\n{text3}\n\n"
            f"Original contract:\n{SAMPLE_CONTRACT}\n\n"
            "Draft specific redline suggestions: exact language changes to propose "
            "for the top 5 riskiest clauses, with reasoning for each."
        )
        step4 = await _emit_step_start(run_id, "Draft Redline Suggestions", StepType.llm, step3.step_id, {"prompt": redline_prompt})
        text4, inp4, out4, dur4 = await _call_claude(client, "You are a contract negotiation expert.", redline_prompt, max_tokens=2048)
        await _complete_step(step4, {"redlines": text4}, inp4, out4, dur4)

        # Step 5: Final
        step5 = await _emit_step_start(run_id, "Contract Analysis Report", StepType.final, step4.step_id, {"summary": "Contract analysis complete"})
        await _complete_step(step5, {"result": text4}, 0, 0, 30)

        await _finish_run(run_id, RunStatus.completed)
        logger.info(f"Contract analyzer completed for run {run_id}")
    except Exception as e:
        logger.exception(f"Contract analyzer failed: {e}")
        await _finish_run(run_id, RunStatus.failed)

REAL_SCENARIOS: dict[str, Any] = {
    "hotel_research": run_hotel_research,
    "code_generator": run_code_generator,
    "research_summarize": run_research_summarize,
    "deep_research": run_deep_research,
    "api_integration": run_api_integration,
    "incident_response": run_incident_response,
    "query_optimizer": run_query_optimizer,
    "microservice_decomposition": run_microservice_decomposition,
    "contract_analyzer": run_contract_analyzer,
}


async def run_real_agent(run_id: str, scenario: str) -> None:
    """Dispatch to the appropriate real agent scenario."""
    handler = REAL_SCENARIOS.get(scenario)
    if not handler:
        logger.error(f"Unknown real scenario: {scenario}")
        await _finish_run(run_id, RunStatus.failed)
        return
    await handler(run_id)
