from pathlib import Path

from backend.config_loader import get_model as _get_model
from backend.json_utils import extract_code
from backend.llm_utils import llm_call
from backend.logger import logger
from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "error_recovery_agent.yaml"


def error_recovery_agent(state: MusicState) -> dict:
    error = state.get("last_runtime_error", "")
    logger.info(f"[error_recovery] fixing runtime error: {error!r}")

    prompt = load_prompt(str(PROMPT_PATH))
    system = interpolate_prompt(prompt["system"], {
        "strudel_code": state.get("strudel_code") or "// empty",
    })
    user = interpolate_prompt(prompt["user"], {
        "error_message": error,
    })

    last_user = next(
        (m["content"] for m in reversed(state.get("conversation_history", []))
         if m.get("role") == "user"),
        "",
    )
    if last_user:
        user = f'ORIGINAL USER REQUEST: "{last_user}"\n\n{user}'

    response = llm_call(
        "error_recovery_agent",
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
    )

    raw = response.choices[0].message.content
    fixed_code = extract_code(raw) or state.get("strudel_code", "")
    logger.info(f"[error_recovery] fixed code: {fixed_code[:80]!r}")

    return {
        "strudel_code": fixed_code,
        "last_runtime_error": "",
    }
