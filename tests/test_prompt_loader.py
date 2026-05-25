import os, tempfile, pytest, yaml
from backend.prompt_loader import load_prompt, interpolate_prompt

def test_load_prompt_returns_system_and_user():
    with tempfile.NamedTemporaryFile(suffix=".yaml", mode="w", delete=False) as f:
        yaml.dump({"system": "You are a musician.", "user": "User said: {message}"}, f)
        path = f.name
    try:
        prompt = load_prompt(path)
        assert "system" in prompt
        assert "user" in prompt
    finally:
        os.unlink(path)

def test_interpolate_fills_placeholders():
    result = interpolate_prompt("Genre: {genre}, BPM: {bpm}", {"genre": "jazz", "bpm": "120"})
    assert result == "Genre: jazz, BPM: 120"

def test_interpolate_unknown_placeholder_preserved():
    # Unknown {placeholders} are left unchanged so JS code examples in prompts don't break
    result = interpolate_prompt("Hello {name}", {})
    assert result == "Hello {name}"

def test_interpolate_non_identifier_braces_preserved():
    # {c d e f}, { }, {3,8} etc. from JS/Strudel code must pass through untouched
    template = 'note("{c d e f g}%8") and { } and {3,8}'
    result = interpolate_prompt(template, {})
    assert result == template

def test_load_prompt_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        load_prompt("/nonexistent/prompt.yaml")
