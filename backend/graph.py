# backend/graph.py
from langgraph.graph import END, START, StateGraph

from backend.agents.creative_agent import creative_agent
from backend.agents.error_recovery_agent import error_recovery_agent
from backend.agents.knobs_agent import knobs_agent
from backend.agents.music_expert import music_expert_agent
from backend.agents.response_agent import response_agent
from backend.agents.strudel_coder import strudel_coder_agent
from backend.agents.supervisor import supervisor_agent
from backend.state import MusicState


def _entry_route(state: MusicState) -> str:
    if state.get("user_intent") == "runtime_error":
        return "error_recovery_agent"
    return "supervisor"


def _route_from_supervisor(state: MusicState) -> str:
    first = (state.get("next_agents") or ["response_agent"])[0]
    valid = {"music_expert", "creative_agent", "strudel_coder", "response_agent"}
    return first if first in valid else "response_agent"


def _route_from_music_expert(state: MusicState) -> str:
    agents = state.get("next_agents", [])
    return "strudel_coder" if "strudel_coder" in agents else "response_agent"


def _route_from_creative(state: MusicState) -> str:
    agents = state.get("next_agents", [])
    return "strudel_coder" if "strudel_coder" in agents else "response_agent"


def build_graph() -> StateGraph:
    g = StateGraph(MusicState)

    g.add_node("supervisor", supervisor_agent)
    g.add_node("music_expert", music_expert_agent)
    g.add_node("creative_agent", creative_agent)
    g.add_node("strudel_coder", strudel_coder_agent)
    g.add_node("knobs_agent", knobs_agent)
    g.add_node("response_agent", response_agent)
    g.add_node("error_recovery_agent", error_recovery_agent)

    g.add_conditional_edges(START, _entry_route, {
        "supervisor": "supervisor",
        "error_recovery_agent": "error_recovery_agent",
    })

    g.add_conditional_edges("supervisor", _route_from_supervisor, {
        "music_expert": "music_expert",
        "creative_agent": "creative_agent",
        "strudel_coder": "strudel_coder",
        "response_agent": "knobs_agent",
    })
    g.add_conditional_edges("music_expert", _route_from_music_expert, {
        "strudel_coder": "strudel_coder",
        "response_agent": "knobs_agent",
    })
    g.add_conditional_edges("creative_agent", _route_from_creative, {
        "strudel_coder": "strudel_coder",
        "response_agent": "knobs_agent",
    })
    g.add_edge("strudel_coder", "knobs_agent")
    g.add_edge("knobs_agent", "response_agent")
    g.add_edge("error_recovery_agent", "response_agent")
    g.add_edge("response_agent", END)

    return g.compile()
