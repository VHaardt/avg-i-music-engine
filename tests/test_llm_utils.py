from unittest.mock import MagicMock, patch

from backend.llm_utils import llm_call


@patch("backend.llm_utils.litellm.completion")
def test_llm_call_normalizes_temperature_for_gpt5(mock_completion):
    mock_completion.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="ok"))]
    )

    llm_call(
        "test_agent",
        model="openai/gpt-5",
        messages=[{"role": "user", "content": "hello"}],
        temperature=0.1,
    )

    assert mock_completion.call_args.kwargs["temperature"] == 1


@patch("backend.llm_utils.litellm.completion")
def test_llm_call_preserves_temperature_for_other_models(mock_completion):
    mock_completion.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="ok"))]
    )

    llm_call(
        "test_agent",
        model="openai/gpt-4o-mini",
        messages=[{"role": "user", "content": "hello"}],
        temperature=0.3,
    )

    assert mock_completion.call_args.kwargs["temperature"] == 0.3


@patch("backend.llm_utils.litellm.completion")
def test_llm_call_does_not_normalize_non_gpt5_prefix_matches(mock_completion):
    mock_completion.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="ok"))]
    )

    llm_call(
        "test_agent",
        model="openai/gpt-50-mini",
        messages=[{"role": "user", "content": "hello"}],
        temperature=0.3,
    )

    assert mock_completion.call_args.kwargs["temperature"] == 0.3


@patch("backend.llm_utils.litellm.completion")
def test_llm_stream_yields_text_chunks(mock_completion):
    from backend.llm_utils import llm_stream

    chunk1 = MagicMock()
    chunk1.choices[0].delta.content = "Hello"
    chunk2 = MagicMock()
    chunk2.choices[0].delta.content = " world"
    chunk3 = MagicMock()
    chunk3.choices[0].delta.content = None  # litellm emits None on final chunk

    mock_completion.return_value = iter([chunk1, chunk2, chunk3])
    result = list(llm_stream("test_agent", model="fake-model", messages=[]))

    assert result == ["Hello", " world"]


@patch("backend.llm_utils.litellm.completion")
def test_llm_stream_passes_stream_true(mock_completion):
    from backend.llm_utils import llm_stream

    mock_completion.return_value = iter([])
    list(llm_stream("test_agent", model="fake-model", messages=[{"role": "user", "content": "x"}]))

    call_kwargs = mock_completion.call_args[1]
    assert call_kwargs.get("stream") is True