import os
from pathlib import Path

from dotenv import load_dotenv
import yaml

_CONFIG_PATH = Path(__file__).parent / "config.yaml"
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
_config: dict | None = None
_env_loaded = False


def _load_env() -> None:
    global _env_loaded
    if _env_loaded:
        return
    load_dotenv(_ENV_PATH, override=False)
    _env_loaded = True


def _load() -> dict:
    global _config
    if _config is None:
        with open(_CONFIG_PATH) as f:
            _config = yaml.safe_load(f)
    return _config


def get_model(env_var: str = "LLM_MODEL") -> str:
    _load_env()
    if value := os.environ.get(env_var):
        return value
    return _load()["llm"]["model"]


def get_creative_model() -> str:
    _load_env()
    if value := os.environ.get("LLM_MODEL_CREATIVE"):
        return value
    return get_model()
