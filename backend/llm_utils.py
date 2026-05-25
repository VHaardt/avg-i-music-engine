from typing import Generator

import litellm
import re

from backend.logger import logger


_GPT5_MODEL_RE = re.compile(r"(^|[/-])gpt-5($|[-/])")


def _normalize_completion_kwargs(kwargs: dict) -> dict:
    model = str(kwargs.get("model", "")).lower()
    temperature = kwargs.get("temperature")

    if temperature is None:
        return kwargs

    if not _GPT5_MODEL_RE.search(model):
        return kwargs

    if temperature == 1:
        return kwargs

    normalized_kwargs = {**kwargs, "temperature": 1}
    logger.warning(
        f"[llm] model {kwargs.get('model', '?')} does not support temperature={temperature}; using temperature=1"
    )
    return normalized_kwargs


def llm_call(agent: str, **kwargs):
    kwargs = _normalize_completion_kwargs(kwargs)
    messages = kwargs.get("messages", [])
    model = kwargs.get("model", "?")

    for msg in messages:
        role = msg.get("role", "?")
        content = msg.get("content", "")
        logger.info(f"[{agent}] → [{role}] {content[:2000]}")

    response = litellm.completion(**kwargs)
    raw = response.choices[0].message.content
    logger.info(f"[{agent}] ← {raw[:2000]}")
    return response


def llm_stream(agent: str, **kwargs) -> Generator[str, None, None]:
    """Streaming variant of llm_call. Yields text chunks as they arrive."""
    kwargs = {**kwargs, "stream": True}
    kwargs = _normalize_completion_kwargs(kwargs)
    messages = kwargs.get("messages", [])
    for msg in messages:
        role = msg.get("role", "?")
        content = msg.get("content", "")
        logger.info(f"[{agent}] → [{role}] {content[:200]}")

    for chunk in litellm.completion(**kwargs):
        content = chunk.choices[0].delta.content
        if content:
            logger.debug(f"[{agent}] chunk: {content!r}")
            yield content
