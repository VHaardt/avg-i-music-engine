# backend/prompt_loader.py
import re
from pathlib import Path

import yaml


def load_prompt(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    with open(p) as f:
        data = yaml.safe_load(f)
    assert "system" in data and "user" in data, \
        f"{path} must have 'system' and 'user' keys"
    return data


def interpolate_prompt(template: str, variables: dict) -> str:
    """Replace {var_name} placeholders in template, leaving all other {…} intact."""
    def _replace(m: re.Match) -> str:
        key = m.group(1)
        return str(variables[key]) if key in variables else m.group(0)

    return re.sub(r'\{([a-zA-Z_]\w*)\}', _replace, template)
