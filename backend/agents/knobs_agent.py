import re
from pathlib import Path

from backend.config_loader import get_model as _get_model
from backend.llm_utils import llm_call
from backend.json_utils import extract_json
from backend.logger import logger
from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "knobs_agent.yaml"

# Params that are standalone top-level calls, not chained methods on patterns
_TOP_LEVEL_PARAMS: frozenset[str] = frozenset({"setcpm", "setcps"})

# Params handled by the dedicated BPM UI knob — never expose as sliders
_BPM_PARAMS: frozenset[str] = frozenset({"setcpm", "cpm", "setcps"})

# Alias groups: musically equivalent params — only one per group survives dedup
_ALIAS_GROUPS: list[frozenset[str]] = [
    frozenset({"lpf", "cutoff", "ctf", "lp"}),
    frozenset({"hpf", "hcutoff", "hp"}),
    frozenset({"gain", "velocity"}),
]

# Canonical min/max ranges that override whatever the LLM returns
_CANONICAL_RANGES: dict[str, tuple[float, float]] = {
    "gain": (0, 1.5), "velocity": (0, 1.5), "postgain": (0, 1.5),
    "lpf": (80, 12000), "hpf": (80, 12000), "cutoff": (80, 12000),
    "lp": (80, 12000), "hp": (80, 12000), "bandf": (80, 12000), "bpf": (80, 12000),
    "lpq": (0, 4), "hpq": (0, 4), "resonance": (0, 4),
    "room": (0, 2),
    "delay": (0, 1), "delayfeedback": (0, 1),
    "delaytime": (0.05, 1),
    "crush": (1, 16),
    "distort": (0, 3), "shape": (0, 3),
    "speed": (0.25, 4),
    "pan": (0, 1),
    "transpose": (-24, 24), "detune": (-24, 24),
    "coarse": (1, 32),
    "tremolo": (0.1, 20),
}


def _apply_canonical_range(knob: dict) -> dict:
    param = knob.get("strudel_param", "")
    if param in _CANONICAL_RANGES:
        lo, hi = _CANONICAL_RANGES[param]
        return {**knob, "min": lo, "max": hi}
    return knob


def _deduplicate_knobs(knobs: list[dict]) -> list[dict]:
    seen_groups: set[int] = set()
    seen_params: set[str] = set()
    result = []
    for knob in knobs:
        param = knob.get("strudel_param", "")
        group_idx = next((i for i, g in enumerate(_ALIAS_GROUPS) if param in g), None)
        if group_idx is not None:
            if group_idx in seen_groups:
                continue
            seen_groups.add(group_idx)
        if param in seen_params:
            continue
        seen_params.add(param)
        result.append(knob)
    return result


def _param_in_code(code: str, param: str) -> bool:
    if param in _TOP_LEVEL_PARAMS:
        # Detect both the correct standalone form and any legacy chained form
        return bool(
            re.search(rf"(?m)^\s*{re.escape(param)}\(", code)
            or re.search(rf"\.{re.escape(param)}\(", code)
        )
    return bool(re.search(rf"\.{re.escape(param)}\(", code))


def _extract_value(code: str, param: str) -> float | None:
    if param in _TOP_LEVEL_PARAMS:
        m = re.search(rf"(?m)^\s*{re.escape(param)}\(([^)]+)\)", code)
    else:
        m = re.search(rf"\.{re.escape(param)}\(([^)]+)\)", code)
    if not m:
        return None
    expr = m.group(1).strip()
    # Safely evaluate simple math expressions like "140/4"
    if re.match(r"^[\d\s+\-*/().]+$", expr):
        try:
            return float(eval(expr))  # noqa: S307 — expr validated as pure math
        except Exception:
            pass
    try:
        return float(expr)
    except ValueError:
        return None


def _inject_param(code: str, param: str, value: float) -> str:
    fmt = f"{value:.3g}"
    if param in _TOP_LEVEL_PARAMS:
        return f"{param}({fmt})\n{code}"
    lines = code.split("\n")
    for i, line in enumerate(lines):
        stripped = line.rstrip()
        if "$:" in stripped:
            lines[i] = stripped + f".{param}({fmt})"
            return "\n".join(lines)
    return code.rstrip() + f"\n$: silence.{param}({fmt})"


def knobs_agent(state: MusicState) -> dict:
    if not state["strudel_code"]:
        logger.debug("[knobs_agent] nessun codice, skip")
        return {"active_knobs": []}

    logger.info("[knobs_agent] generazione knobs")

    prompt = load_prompt(str(PROMPT_PATH))
    system = interpolate_prompt(prompt["system"], {})
    user = interpolate_prompt(prompt["user"], {"strudel_code": state["strudel_code"]})

    response = llm_call(
        "knobs_agent",
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
    )
    knobs = extract_json(response.choices[0].message.content)
    knobs = knobs[:6]

    # Exclude BPM params (handled by dedicated UI knob)
    knobs = [k for k in knobs if k.get("strudel_param", "") not in _BPM_PARAMS]

    # Deduplicate alias groups
    knobs = _deduplicate_knobs(knobs)

    # Apply canonical ranges
    knobs = [_apply_canonical_range(k) for k in knobs]

    code = state["strudel_code"]
    validated = []
    for knob in knobs:
        param = knob.get("strudel_param", "")
        if not param:
            continue
        if _param_in_code(code, param):
            # Sync value to what's actually in the code so the slider starts correctly
            actual = _extract_value(code, param)
            if actual is not None:
                knob = {**knob, "value": actual}
        else:
            # Param missing from code — inject it so the knob has a real reference
            code = _inject_param(code, param, float(knob.get("value", 1.0)))
            logger.info(f"[knobs_agent] param .{param}() iniettato nel codice")
        validated.append(knob)

    logger.info(f"[knobs_agent] {len(validated)} knobs: {[k.get('name') for k in validated]}")
    return {"active_knobs": validated, "strudel_code": code}
