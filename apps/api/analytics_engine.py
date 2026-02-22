"""Analytics engine – reads CSV run/step data and computes optimisation stats.

This module is intentionally pure Python (no FastAPI dependency) so it can be
imported anywhere.  All heavy lifting happens in ``compute_analytics()`` which
returns a plain dict ready for JSON serialisation.
"""
from __future__ import annotations

import csv
import json
import os
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

# ---------------------------------------------------------------------------
# Module-level cache – populated once at startup by main.py
# ---------------------------------------------------------------------------
_RUNS_CSV_TEXT: str = ""
_STEPS_CSV_TEXT: str = ""
_RUNS_ROWS: list[dict[str, Any]] = []
_STEPS_ROWS: list[dict[str, Any]] = []


def load_csv_data(data_dir: str | None = None) -> None:
    """Read the two CSV files from *data_dir* and cache them in module globals."""
    global _RUNS_CSV_TEXT, _STEPS_CSV_TEXT, _RUNS_ROWS, _STEPS_ROWS

    if data_dir is None:
        data_dir = os.path.join(os.path.dirname(__file__), "data")

    runs_path = os.path.join(data_dir, "runsBig.csv")
    steps_path = os.path.join(data_dir, "stepsBig.csv")

    with open(runs_path, "r", encoding="utf-8") as f:
        _RUNS_CSV_TEXT = f.read()
    with open(steps_path, "r", encoding="utf-8") as f:
        _STEPS_CSV_TEXT = f.read()

    _RUNS_ROWS = list(csv.DictReader(_RUNS_CSV_TEXT.splitlines()))
    _STEPS_ROWS = list(csv.DictReader(_STEPS_CSV_TEXT.splitlines()))


def get_runs_csv_text() -> str:
    return _RUNS_CSV_TEXT


def get_steps_csv_text() -> str:
    return _STEPS_CSV_TEXT


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(val: str, default: float = 0.0) -> float:
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def _safe_int(val: str, default: int = 0) -> int:
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _parse_tags(raw: str) -> list[str]:
    """Parse the tags column which is a JSON list stored as a string."""
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []


def _hour_from_iso(iso: str) -> int:
    try:
        return datetime.fromisoformat(iso).hour
    except Exception:
        return -1


def _weekday_from_iso(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).strftime("%A")
    except Exception:
        return "unknown"


# ---------------------------------------------------------------------------
# Main analytics computation
# ---------------------------------------------------------------------------

def compute_analytics() -> dict[str, Any]:
    """Return a comprehensive analytics dict derived from the cached CSV data."""

    runs = _RUNS_ROWS
    steps = _STEPS_ROWS

    if not runs:
        return {"error": "No data loaded – call load_csv_data() first."}

    # ── Build lookup: run_id → run row ────────────────────────────────────
    run_by_id: dict[str, dict] = {r["run_id"]: r for r in runs}

    # ── Attach scenario to each run (from the CSV 'scenario' column) ──────
    # Also build run_id → scenario map for steps
    run_scenario: dict[str, str] = {}
    for r in runs:
        scenario = r.get("scenario", "unknown")
        run_scenario[r["run_id"]] = scenario

    # ── Per-scenario stats ────────────────────────────────────────────────
    scenario_runs: dict[str, list[dict]] = defaultdict(list)
    for r in runs:
        scenario_runs[run_scenario[r["run_id"]]].append(r)

    scenario_steps: dict[str, list[dict]] = defaultdict(list)
    for s in steps:
        sc = run_scenario.get(s["run_id"], "unknown")
        scenario_steps[sc].append(s)

    per_scenario: dict[str, Any] = {}
    for sc, sc_runs in scenario_runs.items():
        total = len(sc_runs)
        completed = sum(1 for r in sc_runs if r.get("status") == "completed")
        failed = sum(1 for r in sc_runs if r.get("status") == "failed")
        success_rate = round(completed / total * 100, 1) if total else 0.0

        sc_step_list = scenario_steps.get(sc, [])
        costs = [_safe_float(s.get("cost_usd", "0")) for s in sc_step_list]
        durations = [_safe_float(s.get("duration_ms", "0")) for s in sc_step_list]
        tokens = [
            _safe_int(s.get("tokens_prompt", "0")) + _safe_int(s.get("tokens_completion", "0"))
            for s in sc_step_list
        ]

        avg_cost = round(sum(costs) / len(costs), 6) if costs else 0.0
        total_cost = round(sum(costs), 4)
        avg_duration = round(sum(durations) / len(durations), 1) if durations else 0.0
        avg_tokens = round(sum(tokens) / len(tokens), 1) if tokens else 0.0

        model_counter: Counter[str] = Counter()
        for s in sc_step_list:
            mid = s.get("model_id", "")
            if mid:
                model_counter[mid] += 1

        failure_step_names: Counter[str] = Counter()
        for s in sc_step_list:
            if s.get("status") == "failed":
                failure_step_names[s.get("name", "unknown")] += 1

        per_scenario[sc] = {
            "total_runs": total,
            "completed": completed,
            "failed": failed,
            "success_rate": success_rate,
            "total_cost_usd": total_cost,
            "avg_cost_per_step": avg_cost,
            "avg_duration_ms": avg_duration,
            "avg_tokens": avg_tokens,
            "top_models": model_counter.most_common(5),
            "failure_step_names": failure_step_names.most_common(5),
        }

    # ── Per-model stats ───────────────────────────────────────────────────
    model_usage: dict[str, list[dict]] = defaultdict(list)
    for s in steps:
        mid = s.get("model_id", "")
        if mid:
            model_usage[mid].append(s)

    per_model: dict[str, Any] = {}
    for model, m_steps in model_usage.items():
        count = len(m_steps)
        costs = [_safe_float(s.get("cost_usd", "0")) for s in m_steps]
        durations = [_safe_float(s.get("duration_ms", "0")) for s in m_steps]
        total_tokens = sum(
            _safe_int(s.get("tokens_prompt", "0")) + _safe_int(s.get("tokens_completion", "0"))
            for s in m_steps
        )
        failed = sum(1 for s in m_steps if s.get("status") == "failed")

        avg_cost = round(sum(costs) / count, 6) if count else 0.0
        cost_per_1k = round((sum(costs) / total_tokens * 1000), 6) if total_tokens else 0.0
        avg_latency = round(sum(durations) / count, 1) if count else 0.0
        failure_rate = round(failed / count * 100, 1) if count else 0.0

        per_model[model] = {
            "usage_count": count,
            "total_cost_usd": round(sum(costs), 4),
            "avg_cost_per_step": avg_cost,
            "cost_per_1k_tokens": cost_per_1k,
            "avg_latency_ms": avg_latency,
            "failure_rate": failure_rate,
            "failed_count": failed,
        }

    # ── Error hotspots ────────────────────────────────────────────────────
    error_hotspots: list[dict[str, Any]] = []
    step_fail_counter: Counter[tuple[str, str]] = Counter()
    for s in steps:
        if s.get("status") == "failed":
            sc = run_scenario.get(s["run_id"], "unknown")
            step_fail_counter[(s.get("name", "unknown"), sc)] += 1

    for (step_name, scenario), count in step_fail_counter.most_common(20):
        error_msg = ""
        for s in steps:
            if s.get("name") == step_name and s.get("status") == "failed" and s.get("error_message"):
                error_msg = s["error_message"]
                break
        error_hotspots.append({
            "step_name": step_name,
            "scenario": scenario,
            "failure_count": count,
            "sample_error": error_msg,
        })

    # ── Merge candidates (scenarios that share ≥50 % step names) ──────────
    scenario_step_names: dict[str, set[str]] = {}
    for sc, sc_steps in scenario_steps.items():
        scenario_step_names[sc] = {s.get("name", "") for s in sc_steps}

    merge_candidates: list[dict[str, Any]] = []
    sc_list = list(scenario_step_names.keys())
    for i in range(len(sc_list)):
        for j in range(i + 1, len(sc_list)):
            a, b = sc_list[i], sc_list[j]
            shared = scenario_step_names[a] & scenario_step_names[b]
            total_unique = scenario_step_names[a] | scenario_step_names[b]
            if total_unique and len(shared) / len(total_unique) >= 0.35:
                merge_candidates.append({
                    "scenario_a": a,
                    "scenario_b": b,
                    "shared_steps": sorted(shared),
                    "overlap_pct": round(len(shared) / len(total_unique) * 100, 1),
                })
    merge_candidates.sort(key=lambda x: x["overlap_pct"], reverse=True)

    # ── Scheduling patterns ───────────────────────────────────────────────
    hour_counter: Counter[int] = Counter()
    day_counter: Counter[str] = Counter()
    for r in runs:
        h = _hour_from_iso(r.get("created_at", ""))
        if h >= 0:
            hour_counter[h] += 1
        d = _weekday_from_iso(r.get("created_at", ""))
        if d != "unknown":
            day_counter[d] += 1

    scheduling = {
        "runs_by_hour": dict(sorted(hour_counter.items())),
        "runs_by_day": dict(day_counter.most_common()),
        "peak_hour": hour_counter.most_common(1)[0] if hour_counter else None,
        "peak_day": day_counter.most_common(1)[0] if day_counter else None,
    }

    # ── Fleet-wide summary ────────────────────────────────────────────────
    total_runs = len(runs)
    total_completed = sum(1 for r in runs if r.get("status") == "completed")
    total_failed = sum(1 for r in runs if r.get("status") == "failed")
    all_costs = [_safe_float(s.get("cost_usd", "0")) for s in steps]
    all_durations = [_safe_float(s.get("duration_ms", "0")) for s in steps]

    fleet_summary = {
        "total_runs": total_runs,
        "total_steps": len(steps),
        "completed_runs": total_completed,
        "failed_runs": total_failed,
        "overall_success_rate": round(total_completed / total_runs * 100, 1) if total_runs else 0,
        "total_cost_usd": round(sum(all_costs), 2),
        "avg_cost_per_step": round(sum(all_costs) / len(all_costs), 6) if all_costs else 0,
        "avg_duration_ms": round(sum(all_durations) / len(all_durations), 1) if all_durations else 0,
        "unique_scenarios": len(scenario_runs),
        "unique_models": len(model_usage),
    }

    return {
        "fleet_summary": fleet_summary,
        "per_scenario": per_scenario,
        "per_model": per_model,
        "error_hotspots": error_hotspots,
        "merge_candidates": merge_candidates,
        "scheduling": scheduling,
    }
