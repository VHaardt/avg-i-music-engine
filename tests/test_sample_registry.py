from backend.sample_registry import get_sample_context, SUPERDIRT_SAMPLES, GM_SOUNDFONTS


def test_get_sample_context_returns_string():
    ctx = get_sample_context()
    assert isinstance(ctx, str)
    assert len(ctx) > 10


def test_get_sample_context_contains_common_samples():
    ctx = get_sample_context()
    for name in ["bd", "sn", "hh", "piano", "bass"]:
        assert name in ctx, f"'{name}' missing from sample context"


def test_superdirt_samples_not_empty():
    assert len(SUPERDIRT_SAMPLES) >= 20


def test_gm_soundfonts_not_empty():
    assert len(GM_SOUNDFONTS) >= 10


def test_no_duplicates():
    all_samples = SUPERDIRT_SAMPLES + GM_SOUNDFONTS
    assert len(all_samples) == len(set(all_samples))
