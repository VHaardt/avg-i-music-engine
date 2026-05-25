import json
import re

from backend.logger import logger


def extract_json(text: str) -> dict | list:
    """Extract JSON from model output that may contain markdown or surrounding text."""
    text = text.strip()

    # Strip markdown code fences: ```json ... ``` or ``` ... ```
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fenced:
        text = fenced.group(1).strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find the first complete JSON object or array in the text
    logger.warning(f"[json_utils] parse diretto fallito, ricerca nel testo ({len(text)} chars)")
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = text.find(start_char)
        if start == -1:
            continue
        # Walk backwards from end to find matching closing bracket
        end = text.rfind(end_char)
        if end <= start:
            continue
        candidate = text[start:end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    raise ValueError(f"No valid JSON found in model output: {text[:200]!r}")


def extract_code(text: str) -> str:
    """Strip markdown code fences from model output, returning bare code."""
    text = text.strip()

    fenced = re.search(r"```(?:\w+)?\s*([\s\S]*?)```", text)
    if fenced:
        return fenced.group(1).strip()

    return text
