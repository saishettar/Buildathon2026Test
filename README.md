# Tenor – AI Agent Observability Platform

> Real-time observability for AI agent execution traces. See every step your AI agents take — rendered as a live, interactive DAG with full step inspection, cost tracking, and AI-powered optimization.

![Status](https://img.shields.io/badge/status-demo-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6)
![Claude](https://img.shields.io/badge/Claude-Sonnet%204-blueviolet)

---

## Overview

Tenor is a production-grade observability platform purpose-built for AI agent systems. It renders real-time execution traces as interactive Directed Acyclic Graphs (DAGs) that grow live as agent steps execute — capturing prompts, completions, tool calls, errors, token counts, costs, and latency for every step.

The platform includes **9 real Claude-powered agent scenarios** that make live Anthropic API calls, plus **5 simulated demo scenarios** for instant demos without API costs.

### Key Features

- **Live Execution Graph** – React Flow-powered DAG that grows in real-time via WebSocket streaming
- **9 Real Claude Agents** – Live Claude API-powered scenarios: hotel research, code generation, deep research, query optimization, and more
- **5 Simulated Scenarios** – Instant demo scenarios with realistic delays and token counts (no API key needed)
- **Node Status Coloring** – Blue (LLM), Purple (Tool), Amber (Plan), Green (Final), Red (Error)
- **Step Inspector** – Slide-over panel with full details: prompts, completions, tool args, errors, tokens, cost
- **Run Explorer Table** – Searchable/filterable table view with type and status filters
- **AI Optimization Dashboard** – Claude-powered fleet analysis with optimization score, agent/model recommendations, and automation suggestions
- **AI Run Analysis** – One-click Claude analysis of any completed run with structured performance reports
- **AI Chat Advisor** – Persistent Claude chat panel with context-aware optimization advice
- **Real-Time WebSockets** – Steps stream live per-run with auto-reconnect
- **Dark Mode** – Dark by default with light mode toggle
- **Retry-Resilient API Calls** – Exponential backoff retry logic for all Claude API calls
- **Production-Grade UI** – shadcn/ui components, skeleton loaders, empty states, animations

---

## Architecture

```
┌─────────────────┐    REST + WebSocket    ┌──────────────────┐     ┌───────────────┐
│   Next.js 14    │ ◄────────────────────► │   FastAPI         │────►│  Claude API   │
│   React 18      │   /api/runs, /api/chat │   (Python)        │     │  (Anthropic)  │
│   TypeScript    │   /api/analyze         │   Pydantic v2     │     └───────────────┘
│   Port 3000     │   ws://…/ws/runs/{id}  │   Port 8000       │
└─────────────────┘                        └────────┬─────────┘
                                                    │
                                              In-Memory Store
                                           (swappable for Postgres)
```

### Data Model (Universal Contract)

A framework-agnostic schema that works with any AI agent system.

**Run:**
```json
{
  "run_id": "uuid",
  "created_at": "iso",
  "updated_at": "iso",
  "status": "running|completed|failed",
  "system_type": "mock|claude|openai|perplexity|openclaw|other",
  "root_step_id": "uuid|null",
  "metadata": { "user_id": "demo", "tags": ["demo"] }
}
```

**Step:**
```json
{
  "step_id": "uuid",
  "run_id": "uuid",
  "parent_step_id": "uuid|null",
  "name": "string",
  "type": "llm|tool|plan|final|error",
  "status": "running|completed|failed|retrying",
  "started_at": "iso",
  "ended_at": "iso|null",
  "duration_ms": 0,
  "tokens_prompt": 0,
  "tokens_completion": 0,
  "cost_usd": 0,
  "input": {},
  "output": {},
  "error": { "message": "", "stack": null, "code": null } | null
}
```

---

## Quickstart

### Prerequisites

- **Node.js** 18+ and **pnpm**
- **Python** 3.9+
- **Anthropic API Key** – required for real Claude agent scenarios and AI features

### 1. Clone & Install

```bash
git clone https://github.com/saishettar/Buildathon2026Test.git
cd Buildathon2026Test

# Install all dependencies at once
pnpm install:all

# Or install separately:
# pnpm install && cd apps/api && pip install -r requirements.txt
```

### 2. Set Your API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start Everything

```bash
pnpm dev
```

This starts both servers concurrently:
- **Web UI:** http://localhost:3000
- **API:** http://localhost:8000

### 4. Run an Agent

1. Open http://localhost:3000
2. Click **"Start Demo Run"** in the left sidebar
3. Choose a **real Claude scenario** (e.g., Hotel Research Agent) or a **simulated scenario**
4. Watch the execution graph build in real-time!
5. Click any node to open the step inspector

---

## Docker Compose (Optional)

For a fully containerized setup with PostgreSQL:

```bash
docker compose up --build
```

This starts:
- **PostgreSQL 16** on port 5432
- **FastAPI** on port 8000
- **Next.js** on port 3000

> The demo currently uses in-memory storage. PostgreSQL is provisioned for production use.

---

## Agent Scenarios

### Real Claude-Powered Agents (requires `ANTHROPIC_API_KEY`)

These scenarios make **live Claude API calls** and produce real LLM outputs:

| Scenario | Description |
|----------|-------------|
| **Hotel Research Agent** | Researches hotels near Times Square, compares prices, and recommends the best option |
| **Code Generator Agent** | Plans, writes, saves, and reviews a Tic Tac Toe game with working Python code |
| **Research & Summarize Agent** | Researches AI regulation across US and EU in parallel and synthesizes findings |
| **Deep Research Agent** | Fact-checking agent that verifies claims using parallel multi-source research with confidence ratings |
| **API Integration Planner** | Designs a Stripe-to-Postgres integration with webhook handler and database layer code generation |
| **Incident Response Agent** | SRE agent that triages alerts, runs parallel diagnostics, identifies root cause, and drafts communications |
| **Query Optimizer Agent** | Analyzes slow SQL queries, rewrites them, generates indexes, and estimates performance gains |
| **Microservice Decomposition Agent** | Decomposes a monolith into microservices with API design, communication mapping, and migration planning |
| **Contract Analyzer Agent** | Legal analyst that reviews SaaS contracts, risk-rates clauses, and drafts redline negotiation suggestions |

### Simulated Demo Scenarios (no API key needed)

| Scenario | Description | Key Features |
|----------|-------------|--------------|
| **Flight Booking** | Agent books a flight, payment fails, retries with backup card | Error → retry flow, red nodes |
| **Research Summarizer** | Parallel web searches, synthesis, final summary | Branching tree, multiple tool calls |
| **Code Assistant** | Reads files, analyzes error, generates fix | Deep chain, mixed tool/LLM steps |
| **Customer Support** | Classifies intent, retrieves KB, drafts response | Multi-tool orchestration |
| **Simple Happy Path** | Plan → Tool → LLM → Final | Clean linear flow |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/scenarios` | List all available scenarios (simulated + real) |
| `POST` | `/api/runs` | Create a simulated run (with scenario) |
| `POST` | `/api/runs/real` | Create a real Claude-powered run |
| `GET` | `/api/runs` | List recent runs (limit param, default 50) |
| `GET` | `/api/runs/{run_id}` | Get a single run |
| `GET` | `/api/runs/{run_id}/steps` | Get all steps for a run |
| `POST` | `/api/steps` | Create a step manually |
| `GET` | `/api/runs/{run_id}/analyze` | Claude-powered run performance analysis |
| `GET` | `/api/steps/{step_id}/summarize` | Claude-powered step summary |
| `POST` | `/api/chat` | Send message to Claude optimization advisor |
| `GET` | `/api/optimization` | AI fleet optimization analysis |
| `WS` | `/ws/runs/{run_id}` | Real-time step/run updates |

### WebSocket Messages

```json
{ "type": "step_update", "step": { ... } }
{ "type": "run_update", "run": { ... } }
```

---

## AI Features

### Fleet Optimization Dashboard (`/optimization`)

Claude analyzes your entire fleet of agent runs and delivers actionable insights:

1. **Analytics Engine** – On startup, loads 1,000 historical runs and 7,388 steps from CSV. A pure-Python analytics engine computes per-scenario stats, per-model breakdowns, error hotspots, and scheduling patterns.
2. **Claude Analysis** – Sends pre-computed analytics to Claude, which returns a structured JSON optimization report.
3. **Caching** – Results cached for 10 minutes. Errors are never cached.

| Section | Description |
|---------|-------------|
| **Optimization Score** | 0–100 gauge (red ≤ 40, amber ≤ 70, green > 70) with summary |
| **Agent Recommendations** | Priority-sorted actions per agent/scenario |
| **Automation Suggestions** | Ideas for automating repetitive patterns |
| **Model Recommendations** | Model swap suggestions with estimated savings |
| **Agents to Watch** | Warning cards for agents with concerning trends |

### Run Performance Analysis

One-click analysis from the **AI Analysis** tab on any run. Claude produces a structured report with: summary, token analysis, cost analysis, latency analysis, error analysis, recommendations, and a 0–100 score.

### Step Summarization

Per-step plain-English explanations of raw input/output data, accessible from the step inspector.

### Chat Advisor

Persistent right-side chat panel on every page. Context-aware — automatically includes current run data for targeted optimization advice.

---

## Cost Calculation

Token costs are computed per-step using model-specific rates:

| Model | Prompt (per 1K) | Completion (per 1K) |
|-------|-----------------|---------------------|
| GPT-4 | $0.030 | $0.060 |
| Claude 3.5 Sonnet | $0.003 | $0.015 |
| Default (demo) | $0.010 | $0.030 |

---

## Project Structure

```
Buildathon2026Test/
├── package.json                    # Root monorepo scripts
├── pnpm-workspace.yaml             # pnpm workspaces config
├── docker-compose.yml              # Containerized deployment
├── PROJECT_DESCRIPTION.txt         # Comprehensive project documentation
├── apps/
│   ├── api/                        # FastAPI backend
│   │   ├── main.py                 # App entrypoint, routes, WebSocket
│   │   ├── models.py               # Pydantic models (Run, Step, enums)
│   │   ├── database.py             # In-memory store (Postgres-ready)
│   │   ├── real_agents.py          # 9 real Claude-powered agent scenarios
│   │   ├── simulator.py            # Simulated step emission engine
│   │   ├── scenarios.py            # 5 demo scenarios + real scenario metadata
│   │   ├── analytics_engine.py     # CSV analytics (per-scenario, per-model)
│   │   ├── optimization.py         # AI fleet optimization (Claude API)
│   │   ├── analysis.py             # Claude run analysis + step summaries
│   │   ├── chat.py                 # Claude optimization chat advisor
│   │   ├── websocket_manager.py    # Per-run WS room manager
│   │   ├── data/                   # Reference CSV datasets
│   │   │   ├── runsBig.csv         # 1,000 historical runs
│   │   │   └── stepsBig.csv        # 7,388 historical steps
│   │   ├── generated/              # Files generated by real agents
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── web/                        # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx       # Root layout with TenorLogo
│       │   │   ├── page.tsx         # Landing page
│       │   │   ├── providers.tsx    # Query + Theme providers
│       │   │   ├── globals.css      # Tailwind + CSS custom properties
│       │   │   ├── dashboard/       # Main dashboard with run grid
│       │   │   ├── optimization/    # AI Optimization dashboard
│       │   │   └── runs/[runId]/    # Run detail with 6-tab interface
│       │   ├── components/
│       │   │   ├── brand/           # TenorLogo with animated SVG
│       │   │   ├── ui/              # shadcn/ui primitives (13+ components)
│       │   │   ├── layout/          # Sidebar, HeaderStats, ThemeToggle
│       │   │   ├── graph/           # ExecutionGraph, StepNode, dagre layout
│       │   │   ├── inspector/       # StepInspector slide-over
│       │   │   ├── explorer/        # RunExplorer table
│       │   │   ├── detail/          # DetailHeader, ExecutionChain, Metrics, AI Advisor
│       │   │   ├── dashboard/       # HeroChart, SummaryStats, AgentCard
│       │   │   ├── optimization/    # ScoreGauge, Recommendations, Suggestions
│       │   │   ├── analysis/        # AnalysisPanel
│       │   │   └── chat/            # ChatPanel
│       │   ├── hooks/               # useRuns, useSteps, useWebSocket, useOptimization
│       │   ├── lib/                 # api, websocket, utils, cost, optimization-api
│       │   └── types/               # TypeScript type definitions
│       ├── package.json
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── next.config.js
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | For real agents & AI features | — | Anthropic API key for Claude |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | Backend REST API URL |
| `NEXT_PUBLIC_WS_URL` | No | `ws://localhost:8000` | Backend WebSocket URL |
| `DATABASE_URL` | Docker only | — | PostgreSQL connection string |
| `CORS_ORIGINS` | Docker only | — | Allowed CORS origins |

---

## Extending for Production

1. **Swap storage** – Replace `database.py` with PostgreSQL via SQLAlchemy/asyncpg. The data model is already Postgres-compatible.
2. **Real agent ingestion** – Use `POST /api/runs` + `POST /api/steps` to ingest traces from any agent framework (LangChain, CrewAI, AutoGen, etc.).
3. **Authentication** – Add JWT auth middleware to FastAPI.
4. **Multi-tenancy** – `RunMetadata.user_id` is already in the schema for per-user filtering.
5. **Alerting** – Add cost budgets and Slack/email notifications on failures.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript 5.4 |
| Styling | Tailwind CSS, shadcn/ui, Radix UI |
| Charts | Recharts, React Flow, dagre |
| State | TanStack Query v5 (React Query) |
| Real-time | WebSockets with auto-reconnect |
| Backend | FastAPI, Pydantic v2, uvicorn |
| AI | Claude Sonnet 4 via Anthropic SDK (with retry + backoff) |
| Storage | In-memory (Postgres-ready schema) |
| Infrastructure | Docker, Docker Compose, pnpm workspaces |

---

## License

MIT