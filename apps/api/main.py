"""Tenor – FastAPI application."""
from __future__ import annotations

import asyncio
import logging
import random
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()  # Load .env file (e.g. ANTHROPIC_API_KEY)

# Fallback: ensure ANTHROPIC_API_KEY is always available (for public deployments)
if not os.environ.get("ANTHROPIC_API_KEY"):
    os.environ["ANTHROPIC_API_KEY"] = "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"

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from models import (
    Run, Step, CreateRunRequest, CreateStepRequest,
    RunStatus, StepStatus, StepType, RunMetadata, SystemType,
)
from database import db
from websocket_manager import manager
from simulator import run_simulation
from scenarios import SCENARIOS, SCENARIO_LABELS, REAL_SCENARIO_META
from real_agents import run_real_agent, REAL_SCENARIOS
from chat import ChatRequest, get_chat_response
from analysis import analyze_run, summarize_step
from optimization import router as optimization_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Tenor API starting up")
    # Load CSV data for the optimization analytics engine
    from analytics_engine import load_csv_data
    import os
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    if os.path.isdir(data_dir):
        load_csv_data(data_dir)
        logger.info("Loaded optimization CSV data from %s", data_dir)
    yield
    logger.info("Tenor API shutting down")


app = FastAPI(
    title="Tenor API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS – allow the Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(optimization_router)

# ── REST Endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "tenor-api"}


@app.get("/api/scenarios")
async def list_scenarios():
    """Return available demo and real scenarios."""
    mock = [
        {"id": k, "label": v, "real": False}
        for k, v in SCENARIO_LABELS.items()
    ]
    real = [
        {"id": s["id"], "label": s["label"], "real": True, "description": s["description"], "icon": s["icon"]}
        for s in REAL_SCENARIO_META
    ]
    return {"scenarios": mock + real}


class RealRunRequest(BaseModel):
    scenario: str


@app.post("/api/runs/real")
async def create_real_run(req: RealRunRequest):
    """Create a run powered by real Claude API calls."""
    if req.scenario not in REAL_SCENARIOS:
        raise HTTPException(status_code=400, detail=f"Unknown real scenario: {req.scenario}")

    live_system_types = [
        SystemType.claude,
        SystemType.openai,
        SystemType.perplexity,
        SystemType.openclaw,
    ]
    run = Run(
        system_type=random.choice(live_system_types),
        metadata=RunMetadata(tags=["real", req.scenario]),
    )
    db.create_run(run)
    logger.info(f"Created real run {run.run_id} (scenario={req.scenario})")

    asyncio.create_task(run_real_agent(run.run_id, req.scenario))

    return run.model_dump()


@app.post("/api/runs")
async def create_run(req: CreateRunRequest):
    """Create a new run and optionally start a simulation."""
    run = Run(
        system_type=req.system_type,
        metadata=req.metadata or RunMetadata(),
    )
    db.create_run(run)
    logger.info(f"Created run {run.run_id} (scenario={req.scenario})")

    # Start simulation in background if a scenario is provided
    if req.scenario and req.scenario in SCENARIOS:
        asyncio.create_task(run_simulation(run.run_id, req.scenario))

    return run.model_dump()


@app.get("/api/runs")
async def list_runs(limit: int = Query(50, ge=1, le=200)):
    """List recent runs."""
    runs = db.list_runs(limit)
    return {"runs": [r.model_dump() for r in runs]}


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    """Get a single run by ID."""
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run.model_dump()


@app.get("/api/runs/{run_id}/steps")
async def get_run_steps(run_id: str):
    """Get all steps for a run."""
    steps = db.get_steps_for_run(run_id)
    return {"steps": [s.model_dump() for s in steps]}


@app.post("/api/steps")
async def create_step(req: CreateStepRequest):
    """Create a step manually (for non-simulated use)."""
    from datetime import datetime, timezone

    step = Step(
        run_id=req.run_id,
        parent_step_id=req.parent_step_id,
        name=req.name,
        type=StepType(req.type),
        input=req.input,
    )
    db.create_step(step)

    await manager.broadcast(req.run_id, {
        "type": "step_update",
        "step": step.model_dump(),
    })

    return step.model_dump()


# ── Analysis Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/runs/{run_id}/analyze")
async def analyze_run_endpoint(run_id: str):
    """Generate a Claude-powered performance analysis for a run."""
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    raw_steps = db.get_steps_for_run(run_id)
    if not raw_steps:
        raise HTTPException(status_code=404, detail="No steps found for this run")

    result = await analyze_run(
        run.model_dump(),
        [s.model_dump() for s in raw_steps],
    )
    return result.model_dump()


@app.get("/api/steps/{step_id}/summarize")
async def summarize_step_endpoint(step_id: str):
    """Generate a human-readable summary of a step's input/output."""
    step = db.get_step(step_id)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    result = await summarize_step(step.model_dump())
    return result.model_dump()


# ── Chat Endpoint ──────────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Send a message to the Claude-powered workflow optimization advisor."""
    run_data = None
    steps_data = None

    if req.run_id:
        run = db.get_run(req.run_id)
        if run:
            run_data = run.model_dump()
        raw_steps = db.get_steps_for_run(req.run_id)
        if raw_steps:
            steps_data = [s.model_dump() for s in raw_steps]

    result = await get_chat_response(req, run_data, steps_data)
    return result.model_dump()


# ── WebSocket ──────────────────────────────────────────────────────────────────

@app.websocket("/ws/runs/{run_id}")
async def websocket_endpoint(ws: WebSocket, run_id: str):
    """Subscribe to real-time updates for a specific run."""
    await manager.connect(run_id, ws)
    try:
        while True:
            # Keep connection alive; client can send ping/pong
            data = await ws.receive_text()
            # Echo back as acknowledgment
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(run_id, ws)
    except Exception:
        manager.disconnect(run_id, ws)
