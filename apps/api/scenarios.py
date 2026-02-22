"""Predefined demo scenarios for the simulator."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ScenarioStep:
    """Blueprint for a step to be emitted during simulation."""
    name: str
    type: str  # llm | tool | plan | final | error
    delay_s: float = 1.0  # seconds to wait before emitting
    duration_ms: int = 0  # simulated processing duration
    tokens_prompt: int = 0
    tokens_completion: int = 0
    children: list["ScenarioStep"] = field(default_factory=list)
    should_fail: bool = False
    retry_of: Optional[str] = None  # name of step this retries
    input_data: dict = field(default_factory=dict)
    output_data: dict = field(default_factory=dict)
    error_data: Optional[dict] = None


SCENARIOS: dict[str, ScenarioStep] = {
    # ── 1. Flight Booking ─────────────────────────────────────────────
    "flight_booking": ScenarioStep(
        name="Flight Booking Agent",
        type="plan",
        delay_s=0.5,
        duration_ms=320,
        tokens_prompt=150,
        tokens_completion=80,
        input_data={"task": "Book a round-trip flight from SFO to JFK for March 15-20"},
        output_data={"plan": ["search_flights", "analyze_options", "book_flight", "process_payment", "confirm"]},
        children=[
            ScenarioStep(
                name="Search Flights",
                type="tool",
                delay_s=1.0,
                duration_ms=2340,
                input_data={"tool": "flight_search_api", "args": {"origin": "SFO", "dest": "JFK", "depart": "2026-03-15", "return": "2026-03-20"}},
                output_data={"results": [{"airline": "United", "price": 450}, {"airline": "Delta", "price": 420}, {"airline": "JetBlue", "price": 380}]},
                children=[
                    ScenarioStep(
                        name="Analyze Flight Options",
                        type="llm",
                        delay_s=0.8,
                        duration_ms=1850,
                        tokens_prompt=820,
                        tokens_completion=340,
                        input_data={"prompt": "Compare these 3 flight options and recommend the best value considering price, airline quality, and timing..."},
                        output_data={"completion": "Based on the analysis, JetBlue offers the best value at $380 with a direct flight. Delta at $420 is also good with better legroom. Recommending JetBlue.", "recommendation": "JetBlue $380"},
                        children=[
                            ScenarioStep(
                                name="Book Selected Flight",
                                type="tool",
                                delay_s=0.6,
                                duration_ms=1200,
                                input_data={"tool": "booking_api", "args": {"airline": "JetBlue", "flight": "B6-415", "passengers": 1}},
                                output_data={"booking_ref": "JB-2026-XK9M", "status": "pending_payment"},
                                children=[
                                    ScenarioStep(
                                        name="Process Payment",
                                        type="tool",
                                        delay_s=0.8,
                                        duration_ms=3200,
                                        should_fail=True,
                                        input_data={"tool": "payment_gateway", "args": {"amount": 380, "currency": "USD", "card_last4": "4242"}},
                                        output_data={},
                                        error_data={"message": "Payment declined: Card issuer returned insufficient funds", "code": "PAYMENT_DECLINED", "stack": "PaymentError: Card declined\\n  at PaymentGateway.charge()\\n  at processPayment()"},
                                        children=[
                                            ScenarioStep(
                                                name="Retry Payment (backup card)",
                                                type="tool",
                                                delay_s=1.5,
                                                duration_ms=2100,
                                                retry_of="Process Payment",
                                                input_data={"tool": "payment_gateway", "args": {"amount": 380, "currency": "USD", "card_last4": "8888", "retry": True}},
                                                output_data={"transaction_id": "txn_9f8e7d6c", "status": "approved", "amount": 380},
                                                children=[
                                                    ScenarioStep(
                                                        name="Generate Confirmation",
                                                        type="llm",
                                                        delay_s=0.6,
                                                        duration_ms=1400,
                                                        tokens_prompt=650,
                                                        tokens_completion=280,
                                                        input_data={"prompt": "Generate a booking confirmation summary for the user..."},
                                                        output_data={"completion": "Your flight has been booked! ✈️\\n\\nBooking Reference: JB-2026-XK9M\\nRoute: SFO → JFK\\nDeparture: March 15, 2026\\nReturn: March 20, 2026\\nAirline: JetBlue\\nTotal: $380.00\\nPayment: Visa ending in 8888"},
                                                        children=[
                                                            ScenarioStep(
                                                                name="Final Output",
                                                                type="final",
                                                                delay_s=0.4,
                                                                duration_ms=120,
                                                                tokens_prompt=100,
                                                                tokens_completion=50,
                                                                input_data={"summary": "Flight booking completed"},
                                                                output_data={"result": "Flight booked successfully. Confirmation: JB-2026-XK9M. JetBlue SFO→JFK, Mar 15-20. Total: $380."},
                                                            ),
                                                        ],
                                                    ),
                                                ],
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            ),
        ],
    ),

    # ── 2. Research Summarizer ────────────────────────────────────────
    "research_summarizer": ScenarioStep(
        name="Research Summarizer Agent",
        type="plan",
        delay_s=0.5,
        duration_ms=280,
        tokens_prompt=200,
        tokens_completion=120,
        input_data={"task": "Research and summarize recent advances in quantum computing"},
        output_data={"plan": ["parallel_web_search", "synthesize", "write_summary"]},
        children=[
            ScenarioStep(
                name="Web Search: Quantum Overview",
                type="tool",
                delay_s=0.8,
                duration_ms=1850,
                input_data={"tool": "web_search", "args": {"query": "quantum computing 2026 breakthroughs overview"}},
                output_data={"results": [{"title": "IBM Quantum Roadmap 2026", "url": "https://example.com/ibm", "snippet": "IBM announces 10,000-qubit processor..."}]},
                children=[
                    ScenarioStep(
                        name="Extract: IBM Developments",
                        type="llm",
                        delay_s=0.6,
                        duration_ms=1200,
                        tokens_prompt=1400,
                        tokens_completion=450,
                        input_data={"prompt": "Extract key facts from these search results about IBM quantum computing developments..."},
                        output_data={"completion": "Key findings:\\n1. IBM's 10,000-qubit Starling processor\\n2. Error correction breakthrough using surface codes\\n3. Quantum advantage demonstrated in materials simulation"},
                    ),
                ],
            ),
            ScenarioStep(
                name="Web Search: Recent Papers",
                type="tool",
                delay_s=1.0,
                duration_ms=2100,
                input_data={"tool": "web_search", "args": {"query": "quantum computing research papers 2025-2026 peer reviewed"}},
                output_data={"results": [{"title": "Logical Qubit Operations at Scale", "url": "https://arxiv.org/example", "snippet": "We demonstrate fault-tolerant quantum computation..."}]},
                children=[
                    ScenarioStep(
                        name="Extract: Paper Highlights",
                        type="llm",
                        delay_s=0.7,
                        duration_ms=1600,
                        tokens_prompt=1800,
                        tokens_completion=600,
                        input_data={"prompt": "Summarize the key contributions from these academic papers..."},
                        output_data={"completion": "Paper highlights:\\n1. Fault-tolerant operations with 99.9% fidelity\\n2. New hybrid quantum-classical algorithms\\n3. Room temperature quantum sensing breakthrough"},
                    ),
                ],
            ),
            ScenarioStep(
                name="Web Search: Industry Analysis",
                type="tool",
                delay_s=1.2,
                duration_ms=1950,
                input_data={"tool": "web_search", "args": {"query": "quantum computing industry market analysis 2026"}},
                output_data={"results": [{"title": "Quantum Computing Market Report 2026", "url": "https://example.com/market", "snippet": "Market expected to reach $12.5B..."}]},
                children=[
                    ScenarioStep(
                        name="Synthesize All Findings",
                        type="llm",
                        delay_s=1.0,
                        duration_ms=2800,
                        tokens_prompt=2400,
                        tokens_completion=900,
                        input_data={"prompt": "Synthesize findings from all three research tracks into a coherent summary..."},
                        output_data={"completion": "Quantum computing in 2026 has reached an inflection point. IBM's Starling processor demonstrates that scale is achievable, while academic research confirms fault tolerance. The market has grown to $12.5B..."},
                        children=[
                            ScenarioStep(
                                name="Write Final Summary",
                                type="llm",
                                delay_s=0.8,
                                duration_ms=3200,
                                tokens_prompt=1800,
                                tokens_completion=1200,
                                input_data={"prompt": "Write a polished executive summary of quantum computing advances in 2026..."},
                                output_data={"completion": "# Quantum Computing: 2026 State of the Art\\n\\n## Executive Summary\\nQuantum computing has reached a critical milestone in 2026..."},
                                children=[
                                    ScenarioStep(
                                        name="Final Output",
                                        type="final",
                                        delay_s=0.4,
                                        duration_ms=80,
                                        tokens_prompt=50,
                                        tokens_completion=30,
                                        input_data={"summary": "Research summary completed"},
                                        output_data={"result": "Generated comprehensive quantum computing research summary with 3 source tracks, 6 key findings, and executive overview."},
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            ),
        ],
    ),

    # ── 3. Code Assistant ─────────────────────────────────────────────
    "code_assistant": ScenarioStep(
        name="Code Debug Assistant",
        type="plan",
        delay_s=0.5,
        duration_ms=350,
        tokens_prompt=180,
        tokens_completion=90,
        input_data={"task": "Fix the failing test in auth_service.py - TypeError on line 42"},
        output_data={"plan": ["read_files", "analyze", "search_docs", "generate_fix", "test"]},
        children=[
            ScenarioStep(
                name="Read Source File",
                type="tool",
                delay_s=0.6,
                duration_ms=180,
                input_data={"tool": "read_file", "args": {"path": "src/auth_service.py"}},
                output_data={"content": "class AuthService:\\n    def authenticate(self, token: str) -> dict:\\n        decoded = jwt.decode(token)\\n        # Line 42: return decoded.user_id  # AttributeError!\\n        return decoded['user_id']"},
            ),
            ScenarioStep(
                name="Read Test File",
                type="tool",
                delay_s=0.4,
                duration_ms=150,
                input_data={"tool": "read_file", "args": {"path": "tests/test_auth.py"}},
                output_data={"content": "def test_authenticate():\\n    service = AuthService()\\n    result = service.authenticate(mock_token)\\n    assert result == 'user_123'"},
                children=[
                    ScenarioStep(
                        name="Analyze Error Pattern",
                        type="llm",
                        delay_s=0.8,
                        duration_ms=2100,
                        tokens_prompt=1200,
                        tokens_completion=450,
                        input_data={"prompt": "Analyze the TypeError in auth_service.py line 42. The code tries to access .user_id as an attribute but jwt.decode() returns a dict..."},
                        output_data={"completion": "The bug is on line 42 of auth_service.py. jwt.decode() returns a dictionary, not an object with attributes. The code uses decoded.user_id (attribute access) instead of decoded['user_id'] (dict key access).\\n\\nFix: Change `decoded.user_id` to `decoded['user_id']`"},
                        children=[
                            ScenarioStep(
                                name="Search JWT Documentation",
                                type="tool",
                                delay_s=0.5,
                                duration_ms=1400,
                                input_data={"tool": "search_docs", "args": {"query": "PyJWT decode return type"}},
                                output_data={"results": [{"doc": "jwt.decode() -> dict: Returns the decoded token payload as a dictionary"}]},
                            ),
                            ScenarioStep(
                                name="Search Similar Issues",
                                type="tool",
                                delay_s=0.5,
                                duration_ms=980,
                                input_data={"tool": "search_codebase", "args": {"query": "jwt.decode attribute access pattern"}},
                                output_data={"results": [{"file": "src/middleware.py", "line": 15, "code": "user = decoded['sub']  # correct pattern"}]},
                                children=[
                                    ScenarioStep(
                                        name="Generate Fix",
                                        type="llm",
                                        delay_s=0.6,
                                        duration_ms=1800,
                                        tokens_prompt=1500,
                                        tokens_completion=380,
                                        input_data={"prompt": "Generate a code fix for the auth_service.py TypeError. Change attribute access to dictionary key access..."},
                                        output_data={"completion": "```python\\n# auth_service.py - Fixed\\nclass AuthService:\\n    def authenticate(self, token: str) -> str:\\n        decoded = jwt.decode(token, options={'verify_signature': True})\\n        return decoded['user_id']  # Fixed: dict access instead of attribute\\n```"},
                                        children=[
                                            ScenarioStep(
                                                name="Apply Patch",
                                                type="tool",
                                                delay_s=0.5,
                                                duration_ms=220,
                                                input_data={"tool": "apply_edit", "args": {"file": "src/auth_service.py", "line": 42, "old": "return decoded.user_id", "new": "return decoded['user_id']"}},
                                                output_data={"applied": True, "file": "src/auth_service.py"},
                                                children=[
                                                    ScenarioStep(
                                                        name="Run Tests",
                                                        type="tool",
                                                        delay_s=0.8,
                                                        duration_ms=3400,
                                                        input_data={"tool": "run_tests", "args": {"path": "tests/test_auth.py"}},
                                                        output_data={"passed": 5, "failed": 0, "total": 5, "output": "All 5 tests passed ✓"},
                                                        children=[
                                                            ScenarioStep(
                                                                name="Format Response",
                                                                type="llm",
                                                                delay_s=0.4,
                                                                duration_ms=900,
                                                                tokens_prompt=600,
                                                                tokens_completion=200,
                                                                input_data={"prompt": "Summarize the bug fix and test results for the user..."},
                                                                output_data={"completion": "Fixed the TypeError in auth_service.py. The issue was using attribute access (.user_id) on a dictionary returned by jwt.decode(). Changed to dictionary key access (['user_id']). All 5 tests now pass."},
                                                                children=[
                                                                    ScenarioStep(
                                                                        name="Final Output",
                                                                        type="final",
                                                                        delay_s=0.3,
                                                                        duration_ms=60,
                                                                        tokens_prompt=80,
                                                                        tokens_completion=40,
                                                                        input_data={"summary": "Bug fix completed"},
                                                                        output_data={"result": "Fixed TypeError in auth_service.py:42. Changed decoded.user_id to decoded['user_id']. All 5 tests passing."},
                                                                    ),
                                                                ],
                                                            ),
                                                        ],
                                                    ),
                                                ],
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            ),
        ],
    ),

    # ── 4. Customer Support Agent ─────────────────────────────────────
    "customer_support": ScenarioStep(
        name="Customer Support Agent",
        type="plan",
        delay_s=0.5,
        duration_ms=290,
        tokens_prompt=160,
        tokens_completion=85,
        input_data={"task": "Handle customer inquiry: 'I was charged twice for my subscription'"},
        output_data={"plan": ["classify", "retrieve_context", "draft_response", "quality_check"]},
        children=[
            ScenarioStep(
                name="Classify Intent",
                type="llm",
                delay_s=0.7,
                duration_ms=1100,
                tokens_prompt=450,
                tokens_completion=120,
                input_data={"prompt": "Classify this customer inquiry: 'I was charged twice for my subscription'. Categories: billing, technical, account, general"},
                output_data={"completion": "Classification: BILLING\\nSub-category: DUPLICATE_CHARGE\\nSentiment: FRUSTRATED\\nPriority: HIGH\\nUrgency: MEDIUM"},
                children=[
                    ScenarioStep(
                        name="Retrieve KB Articles",
                        type="tool",
                        delay_s=0.6,
                        duration_ms=850,
                        input_data={"tool": "knowledge_base_search", "args": {"query": "duplicate charge refund policy", "category": "billing"}},
                        output_data={"articles": [{"id": "KB-1042", "title": "Duplicate Charge Refund Process", "content": "If a customer reports a duplicate charge, verify in Stripe dashboard and issue immediate refund..."}]},
                    ),
                    ScenarioStep(
                        name="Search Customer History",
                        type="tool",
                        delay_s=0.5,
                        duration_ms=620,
                        input_data={"tool": "crm_search", "args": {"customer_id": "cust_abc123", "type": "billing_events"}},
                        output_data={"events": [{"date": "2026-02-18", "type": "charge", "amount": 29.99}, {"date": "2026-02-18", "type": "charge", "amount": 29.99, "note": "duplicate"}]},
                    ),
                    ScenarioStep(
                        name="Sentiment Analysis",
                        type="llm",
                        delay_s=0.4,
                        duration_ms=780,
                        tokens_prompt=350,
                        tokens_completion=90,
                        input_data={"prompt": "Analyze customer sentiment and determine appropriate tone for response..."},
                        output_data={"completion": "Sentiment: Frustrated but not angry. Tone recommendation: Empathetic, apologetic, action-oriented. Avoid: Blame language, excessive formality."},
                        children=[
                            ScenarioStep(
                                name="Draft Response",
                                type="llm",
                                delay_s=0.8,
                                duration_ms=2200,
                                tokens_prompt=1600,
                                tokens_completion=550,
                                input_data={"prompt": "Draft a customer support response addressing the duplicate charge. Use KB article KB-1042 and customer billing history. Be empathetic and solution-oriented..."},
                                output_data={"completion": "Hi there,\\n\\nI'm sorry about the duplicate charge on your account — I can see it happened on Feb 18th and completely understand your frustration.\\n\\nI've already initiated a refund of $29.99 for the duplicate charge. You should see it back in your account within 3-5 business days.\\n\\nTo prevent this from happening again, I've also flagged your account for our billing team to review.\\n\\nIs there anything else I can help you with?\\n\\nBest,\\nSupport Team"},
                                children=[
                                    ScenarioStep(
                                        name="Quality Check",
                                        type="llm",
                                        delay_s=0.5,
                                        duration_ms=1400,
                                        tokens_prompt=900,
                                        tokens_completion=180,
                                        input_data={"prompt": "Review this customer support response for: accuracy, tone, completeness, policy compliance..."},
                                        output_data={"completion": "Quality check PASSED:\\n✓ Accurate: References correct charge amount and date\\n✓ Tone: Empathetic and professional\\n✓ Complete: Addresses issue + provides timeline\\n✓ Policy: Follows KB-1042 refund process\\nScore: 95/100"},
                                        children=[
                                            ScenarioStep(
                                                name="Final Output",
                                                type="final",
                                                delay_s=0.3,
                                                duration_ms=90,
                                                tokens_prompt=60,
                                                tokens_completion=30,
                                                input_data={"summary": "Customer support response ready"},
                                                output_data={"result": "Response drafted and quality-checked (95/100). Duplicate charge of $29.99 identified and refund initiated. Ready to send to customer."},
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            ),
        ],
    ),

    # ── 5. Simple Happy Path ──────────────────────────────────────────
    "simple_happy_path": ScenarioStep(
        name="Simple Task Agent",
        type="plan",
        delay_s=0.4,
        duration_ms=200,
        tokens_prompt=100,
        tokens_completion=50,
        input_data={"task": "Look up the current weather in San Francisco"},
        output_data={"plan": ["lookup_weather", "format_response"]},
        children=[
            ScenarioStep(
                name="Weather API Lookup",
                type="tool",
                delay_s=0.8,
                duration_ms=1100,
                input_data={"tool": "weather_api", "args": {"location": "San Francisco, CA", "units": "imperial"}},
                output_data={"temperature": 62, "condition": "Partly Cloudy", "humidity": 68, "wind": "12 mph NW"},
                children=[
                    ScenarioStep(
                        name="Format Weather Response",
                        type="llm",
                        delay_s=0.6,
                        duration_ms=1400,
                        tokens_prompt=380,
                        tokens_completion=150,
                        input_data={"prompt": "Format this weather data into a friendly, concise response for the user..."},
                        output_data={"completion": "It's currently 62°F and partly cloudy in San Francisco. Humidity is at 68% with northwest winds at 12 mph. A nice day to be outside! 🌤️"},
                        children=[
                            ScenarioStep(
                                name="Final Output",
                                type="final",
                                delay_s=0.3,
                                duration_ms=50,
                                tokens_prompt=50,
                                tokens_completion=25,
                                input_data={"summary": "Weather lookup completed"},
                                output_data={"result": "San Francisco: 62°F, Partly Cloudy, 68% humidity, 12 mph NW wind."},
                            ),
                        ],
                    ),
                ],
            ),
        ],
    ),
}

SCENARIO_LABELS: dict[str, str] = {
    "flight_booking": "Flight Booking (fails → retries → succeeds)",
    "research_summarizer": "Research Summarizer (parallel web searches)",
    "code_assistant": "Code Assistant (debug + multiple tools)",
    "customer_support": "Customer Support (classify + retrieve + draft)",
    "simple_happy_path": "Simple Happy Path (plan → tool → final)",
}

REAL_SCENARIO_META: list[dict] = [
    {
        "id": "hotel_research",
        "name": "Hotel Research Agent",
        "label": "🏨 Hotel Research Agent",
        "description": "Real Claude-powered agent that researches hotels, compares prices, and recommends the best option",
        "real": True,
        "icon": "🏨",
    },
    {
        "id": "code_generator",
        "name": "Code Generator Agent",
        "label": "💻 Code Generator Agent",
        "description": "Real Claude-powered agent that plans, writes, saves, and reviews a Tic Tac Toe game",
        "real": True,
        "icon": "💻",
    },
    {
        "id": "research_summarize",
        "name": "Research & Summarize Agent",
        "label": "📊 Research & Summarize Agent",
        "description": "Real Claude-powered agent that researches AI regulation across US and EU in parallel and synthesizes findings",
        "real": True,
        "icon": "📊",
    },
]
