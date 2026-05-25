import json
from pathlib import Path

from backend.config_loader import get_creative_model as _get_model
from backend.llm_utils import llm_call
from backend.json_utils import extract_json
from backend.logger import logger
from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "creative_agent.yaml"


def creative_agent(state: MusicState) -> dict:
    mode = "autonomous" if state["creative_mode"] else "advisor"
    last_message = (
        state["conversation_history"][-1]["content"]
        if state["conversation_history"] else ""
    )
    logger.info(f"[creative_agent] mode={mode}")

    prompt = load_prompt(str(PROMPT_PATH))
    system = interpolate_prompt(prompt["system"], {
        "strudel_code": state["strudel_code"] or "// empty",
        "musical_context": json.dumps(state["musical_context"]),
        "mode": mode,
    })
    user = interpolate_prompt(prompt["user"], {
        "user_message": last_message,
        "strudel_code": state["strudel_code"] or "// empty",
        "musical_context": json.dumps(state["musical_context"]),
    })

    response = llm_call(
        "creative_agent",
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.8,
    )
    result = extract_json(response.choices[0].message.content)

    updates: dict = {"creative_suggestions": result.get("suggestions", [])}
    if mode == "autonomous" and result.get("musical_specs"):
        updates["musical_context"] = {**state["musical_context"], **result["musical_specs"]}
    logger.info(f"[creative_agent] {len(updates.get('creative_suggestions', []))} suggerimenti")
    return updates
