import json
from pathlib import Path

from backend.config_loader import get_model as _get_model
from backend.json_utils import extract_json
from backend.llm_utils import llm_call
from backend.logger import logger
from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "music_expert.yaml"


def music_expert_agent(state: MusicState) -> dict:
    last_message = (
        state["conversation_history"][-1]["content"]
        if state["conversation_history"] else ""
    )
    logger.info(f"[music_expert] analisi: {last_message!r}")

    prompt = load_prompt(str(PROMPT_PATH))
    system = interpolate_prompt(prompt["system"], {
        "musical_context": json.dumps(state["musical_context"]),
    })
    user = interpolate_prompt(prompt["user"], {
        "user_message": last_message,
        "musical_context": json.dumps(state["musical_context"]),
    })

    response = llm_call(
        "music_expert",
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.3,
    )
    updates = extract_json(response.choices[0].message.content)
    logger.info(f"[music_expert] contesto aggiornato: {list(updates.keys())}")
    return {"musical_context": {**state["musical_context"], **updates}}
