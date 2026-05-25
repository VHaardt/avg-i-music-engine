import os

from backend import config_loader


def test_load_env_reads_project_dotenv(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "OPENAI_API_KEY=test-openai-key\nLLM_MODEL=openai/gpt-4o-mini\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(config_loader, "_ENV_PATH", env_file)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    config_loader._config = None
    config_loader._env_loaded = False

    assert config_loader.get_model() == "openai/gpt-4o-mini"
    assert os.environ["OPENAI_API_KEY"] == "test-openai-key"


def test_explicit_environment_variable_overrides_dotenv(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("LLM_MODEL=openai/gpt-4o-mini\n", encoding="utf-8")

    monkeypatch.setattr(config_loader, "_ENV_PATH", env_file)
    monkeypatch.setenv("LLM_MODEL", "openai/gpt-4.1-mini")
    config_loader._config = None
    config_loader._env_loaded = False

    assert config_loader.get_model() == "openai/gpt-4.1-mini"