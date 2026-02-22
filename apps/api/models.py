"""Pydantic models matching the universal contract."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────────────

class RunStatus(str, Enum):
    running = "running"
    completed = "completed"
    failed = "failed"


class SystemType(str, Enum):
    mock = "mock"
    openclaw = "openclaw"
    claude = "claude"
    openai = "openai"
    perplexity = "perplexity"
    other = "other"


class StepType(str, Enum):
    llm = "llm"
    tool = "tool"
    plan = "plan"
    final = "final"
    error = "error"


class StepStatus(str, Enum):
    running = "running"
    completed = "completed"
    failed = "failed"
    retrying = "retrying"


# ── Shared sub-models ──────────────────────────────────────────────────────────

class RunMetadata(BaseModel):
    user_id: str = "demo"
    tags: list[str] = Field(default_factory=lambda: ["demo"])


class StepError(BaseModel):
    message: str
    stack: Optional[str] = None
    code: Optional[str] = None


# ── Core models ────────────────────────────────────────────────────────────────

class Run(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: RunStatus = RunStatus.running
    system_type: SystemType = SystemType.mock
    root_step_id: Optional[str] = None
    metadata: RunMetadata = Field(default_factory=RunMetadata)


class Step(BaseModel):
    step_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    run_id: str
    parent_step_id: Optional[str] = None
    name: str
    type: StepType
    status: StepStatus = StepStatus.running
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ended_at: Optional[str] = None
    duration_ms: int = 0
    tokens_prompt: int = 0
    tokens_completion: int = 0
    cost_usd: float = 0.0
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    error: Optional[StepError] = None


# ── Request / Response helpers ─────────────────────────────────────────────────

class CreateRunRequest(BaseModel):
    system_type: SystemType = SystemType.mock
    scenario: Optional[str] = None
    metadata: Optional[RunMetadata] = None


class CreateStepRequest(BaseModel):
    run_id: str
    parent_step_id: Optional[str] = None
    name: str
    type: StepType
    input: dict[str, Any] = Field(default_factory=dict)
