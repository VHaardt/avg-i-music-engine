import json
import re
from pathlib import Path

from backend.config_loader import get_model as _get_model
from backend.llm_utils import llm_call
from backend.json_utils import extract_code
from backend.logger import logger
from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.sample_registry import get_sample_context, is_valid_sound
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "strudel_coder.yaml"
MAX_RETRIES = 2

_SOUND_SOURCE_RE = re.compile(r'\b(s|sound|note|freq|chord)\s*\(')
# Matches quoted tokens inside s("...") / sound("...") calls
_SOUND_NAME_RE = re.compile(r'\b(?:s|sound)\s*\(\s*["\']([^"\']+)["\']')
# Detects GM-style hyphenated names without the required gm_ prefix
_HYPHEN_GM_RE = re.compile(r'^(?:lead|pad|fx|synth|acoustic|electric|overdriven|distortion)-')


def _validate_strudel_code(code: str) -> str | None:
    """Return an error description if code is invalid, None if valid."""
    stripped = code.strip()
    if not stripped:
        return "Output is empty."
    non_comment = re.sub(r'//[^\n]*', '', stripped).strip()
    if not non_comment:
        return "Output contains only comments with no runnable code."
    if not _SOUND_SOURCE_RE.search(code):
        return (
            "No sound source found. Code must contain at least one of: "
            "s(), sound(), note(), freq(), chord()."
        )
    if re.search(r'\.\s*setcpm\s*\(', code):
        return (
            "setcpm() must be a standalone top-level call, never chained on a pattern. "
            "WRONG: sound('bd').setcpm(120). CORRECT: setcpm(120/4) on its own line."
        )
    if re.search(r'\.bank\s*\(', code):
        return (
            ".bank() is not available in this environment — it loads samples from a CDN "
            "that is not configured. Use plain sound names: sound('bd*4'), note('c3').s('piano'), etc."
        )
    # Check for GM soundfont names used without the required gm_ prefix
    for match in _SOUND_NAME_RE.finditer(code):
        tokens = re.split(r'[\s,<>\[\]|*?@!~]+', match.group(1))
        for token in tokens:
            if not token:
                continue
            base = token.split(":")[0]
            if _HYPHEN_GM_RE.match(base) and not is_valid_sound(base):
                correct = "gm_" + base.replace("-", "_")
                return (
                    f'Invalid sound name "{base}". GM soundfonts require the gm_ prefix '
                    f'with underscores. Use "{correct}" instead.'
                )
    return None


def _extract_knob_change(state: MusicState) -> str:
    if not state["conversation_history"]:
        return "none"
    last = state["conversation_history"][-1]["content"]
    return last if last.startswith("[KNOB]") else "none"


def strudel_coder_agent(state: MusicState) -> dict:
    knob_change = _extract_knob_change(state)
    logger.info(f"[strudel_coder] generating code (knob_change={knob_change!r})")

    last_message = (
        state["conversation_history"][-1]["content"]
        if state["conversation_history"] else ""
    )

    prompt = load_prompt(str(PROMPT_PATH))
    system = interpolate_prompt(prompt["system"], {
        "strudel_code": state["strudel_code"] or "// empty",
        "musical_context": json.dumps(state["musical_context"]),
        "knob_change": knob_change,
        "available_samples": get_sample_context(),
    })
    runtime_error = state.get("last_runtime_error", "")
    current_code = state["strudel_code"] or ""
    user_request_prefix = f'USER\'S EXACT REQUEST: "{last_message}"\n\n' if last_message else ""
    if current_code:
        base_user = interpolate_prompt(prompt["user"], {
            "musical_specs": json.dumps(state["musical_context"]),
            "strudel_code": current_code,
        })
        base_user = (
            f"{user_request_prefix}"
            f"CURRENT CODE (modify this surgically — keep what works, "
            f"change only what the user asked, delete blocks the user asks to remove):\n"
            f"```\n{current_code}\n```\n\n"
            f"MUSICAL SPECIFICATIONS:\n{base_user}"
        )
    else:
        base_user = interpolate_prompt(prompt["user"], {
            "musical_specs": json.dumps(state["musical_context"]),
            "strudel_code": "// empty — generate fresh",
        })
        base_user = f"{user_request_prefix}{base_user}"
    if runtime_error:
        base_user += (
            f"\n\nPREVIOUS BROWSER RUNTIME ERROR: {runtime_error}\n"
            "The browser reported this error when executing the last generated code. "
            "Ensure the new code does NOT repeat this mistake."
        )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": base_user},
    ]

    code = ""
    for attempt in range(1, MAX_RETRIES + 2):
        response = llm_call(
            "strudel_coder",
            model=_get_model(),
            messages=messages,
            temperature=0.2,
        )
        raw = response.choices[0].message.content
        code = extract_code(raw)
        error = _validate_strudel_code(code)

        if error is None:
            logger.info(f"[strudel_coder] valid code ({len(code)} chars, attempt {attempt})")
            return {"strudel_code": code, "code_error": "", "last_runtime_error": ""}

        logger.warning(f"[strudel_coder] attempt {attempt} invalid — {error}")
        if attempt <= MAX_RETRIES:
            messages.append({"role": "assistant", "content": raw})
            messages.append({
                "role": "user",
                "content": (
                    f"The code you returned is invalid: {error}\n"
                    "Output only valid, runnable Strudel code that contains at least one "
                    "sound source (s(), sound(), note(), freq(), or chord()). "
                    "No explanations, no markdown — only the code."
                ),
            })

    logger.error(f"[strudel_coder] all {MAX_RETRIES + 1} attempts produced invalid code — {error}")
    return {"strudel_code": code, "code_error": error}
