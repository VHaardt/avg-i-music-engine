# backend/state.py
import operator
from dataclasses import dataclass
from typing import Annotated, TypedDict


@dataclass
class KnobConfig:
    name: str
    strudel_param: str
    min: float
    max: float
    value: float
    color: str = "#9cf"


class MusicState(TypedDict):
    strudel_code: str
    musical_context: dict
    conversation_history: Annotated[list, operator.add]
    active_knobs: list
    user_intent: str
    creative_mode: bool
    creative_suggestions: list
    agent_message: str
    next_agents: list
    code_error: str
    last_runtime_error: str


def create_initial_state() -> MusicState:
    return MusicState(
        strudel_code="",
        musical_context={},
        conversation_history=[],
        active_knobs=[],
        user_intent="",
        creative_mode=False,
        creative_suggestions=[],
        agent_message="",
        next_agents=[],
        code_error="",
        last_runtime_error="",
    )
