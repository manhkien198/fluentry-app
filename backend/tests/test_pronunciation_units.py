from __future__ import annotations

from pathlib import Path

from app.services.pronunciation.feedback import generate_tips
from app.services.pronunciation.textgrid_parser import parse_textgrid
from app.services.pronunciation.engine import run_pronunciation_engine
from app.services.pronunciation.features import extract_features
from app.services.pronunciation.phonemizer import phonemize_text
from app.services.pronunciation.aligner import align_expected_text
from app.services.pronunciation.scorer import score_pronunciation


def test_generate_tips_name_and_multiple_warnings():
    result = {
        "words": [
            {"text": "Name", "status": "warning"},
            {"text": "anna", "status": "warning"},
            {"text": "hello", "status": "good"},
        ]
    }

    tips = generate_tips(result)
    assert "Open vowels more clearly on stressed words." in tips
    assert "Slow down slightly so each important word gets a cleaner ending sound." in tips
    assert tips[-1] == "Practice the sentence again with smoother pacing from the middle to the end."


def test_generate_tips_default_when_all_good():
    result = {"words": [{"text": "hello", "status": "good"}]}

    tips = generate_tips(result)
    assert tips[0] == "Keep a steady rhythm through the full sentence."
    assert len(tips) == 2


def test_parse_textgrid_builds_word_phone_mapping(tmp_path: Path):
    tg = tmp_path / "sample.TextGrid"
    tg.write_text(
        "\n".join(
            [
                'name = "words"',
                "intervals [1]:",
                "xmin = 0.00",
                "xmax = 0.50",
                'text = "hello"',
                "intervals [2]:",
                "xmin = 0.50",
                "xmax = 1.00",
                'text = "world"',
                'name = "phones"',
                "intervals [1]:",
                "xmin = 0.05",
                "xmax = 0.20",
                'text = "HH"',
                "intervals [2]:",
                "xmin = 0.60",
                "xmax = 0.80",
                'text = "W"',
            ]
        ),
        encoding="utf-8",
    )

    parsed = parse_textgrid(tg)
    assert [w["text"] for w in parsed["words"]] == ["hello", "world"]
    assert [p["text"] for p in parsed["phones"]] == ["HH", "W"]
    assert parsed["phones"][0]["word"] == "hello"
    assert parsed["phones"][1]["word"] == "world"


def test_parse_textgrid_skips_blank_items_and_unmatched_phone(tmp_path: Path):
    tg = tmp_path / "blank.TextGrid"
    tg.write_text(
        "\n".join(
            [
                'name = "words"',
                "intervals [1]:",
                "xmin = 0.00",
                "xmax = 0.10",
                'text = ""',
                'name = "phones"',
                "intervals [1]:",
                "xmin = 1.00",
                "xmax = 1.10",
                'text = "S"',
            ]
        ),
        encoding="utf-8",
    )

    parsed = parse_textgrid(tg)
    assert parsed["words"] == []
    assert len(parsed["phones"]) == 1
    assert parsed["phones"][0]["word"] is None


def test_run_pronunciation_engine_switches_engine(monkeypatch):
    monkeypatch.setattr(
        "app.services.pronunciation.engine.align_expected_text",
        lambda *_args, **_kwargs: {"alignment_status": "mfa", "segments": [], "phones": []},
    )
    monkeypatch.setattr("app.services.pronunciation.engine.phonemize_text", lambda *_args, **_kwargs: ["HH", "AH"])
    monkeypatch.setattr(
        "app.services.pronunciation.engine.extract_features",
        lambda *_args, **_kwargs: {"audio_penalty": 0, "energy": 0.9, "rhythm": 0.8, "word_count": 2, "estimated_duration_ms": 1000},
    )

    result = run_pronunciation_engine("hello world", audio_path=None, session_id="s1")
    assert result["alignment"]["alignment_status"] == "mfa"
    assert result["phoneme_map"] == ["HH", "AH"]
    assert "mfa_enabled" in result["config"]


def test_extract_features_with_and_without_audio(tmp_path: Path):
    no_audio = extract_features("hello world")
    assert no_audio["word_count"] == 2
    assert no_audio["audio_penalty"] == 0

    missing_audio = extract_features("hello world", str(tmp_path / "missing.wav"))
    assert missing_audio["audio_penalty"] == 6

    tiny = tmp_path / "tiny.wav"
    tiny.write_bytes(b"x" * 1024)
    tiny_audio = extract_features("hello world", str(tiny))
    assert tiny_audio["audio_penalty"] == 4


def test_phonemize_text_returns_uppercase_preview():
    result = phonemize_text("Anna goes.")
    assert result[0]["word"] == "Anna"
    assert result[0]["phonemes"] == ["A", "N", "N", "A"]


def test_align_expected_text_fallback_and_mfa(monkeypatch):
    monkeypatch.setattr("app.services.pronunciation.aligner.MFA_ENABLED", True)
    monkeypatch.setattr(
        "app.services.pronunciation.aligner.run_mfa_alignment",
        lambda *_args, **_kwargs: {"ok": False, "reason": "mfa_failed"},
    )
    fallback = align_expected_text("hello world", session_id="s1", audio_path="/tmp/a.wav")
    assert fallback["alignment_status"] == "fallback_heuristic"
    assert fallback["engine_meta"]["failure_reason"] == "mfa_failed"

    monkeypatch.setattr(
        "app.services.pronunciation.aligner.run_mfa_alignment",
        lambda *_args, **_kwargs: {"ok": True, "textgrid_path": "x.TextGrid", "prepared_audio_path": "/tmp/a.wav"},
    )
    monkeypatch.setattr(
        "app.services.pronunciation.aligner.parse_textgrid",
        lambda *_args, **_kwargs: {"words": [{"text": "hello"}], "phones": [{"text": "HH"}]},
    )
    ok = align_expected_text("hello world", session_id="s1", audio_path="/tmp/a.wav")
    assert ok["alignment_status"] == "mfa"
    assert ok["segments"][0]["text"] == "hello"


def test_score_pronunciation_shapes_words_phonemes_and_feedback(monkeypatch, tmp_path: Path):
    audio = tmp_path / "a.wav"
    audio.write_bytes(b"x" * 1024)

    monkeypatch.setattr(
        "app.services.pronunciation.scorer.run_pronunciation_engine",
        lambda *_args, **_kwargs: {
            "alignment": {
                "alignment_status": "mfa",
                "segments": [{"text": "Anna"}, {"text": "name"}],
                "phones": [
                    {"text": "AE", "word": "anna", "start_ms": 0, "end_ms": 40, "duration_ms": 40},
                    {"text": "M", "word": "name", "start_ms": 50, "end_ms": 70, "duration_ms": 20},
                ],
                "engine_meta": {},
            },
            "phoneme_map": [{"word": "Anna", "phonemes": ["A", "N"]}],
            "features": {"audio_penalty": 4, "energy": 0.8, "rhythm": 0.85, "word_count": 2, "estimated_duration_ms": 720},
        },
    )

    scored = score_pronunciation("sid-1", "Anna name", str(audio))
    assert scored["session_id"] == "sid-1"
    assert len(scored["words"]) == 2
    assert len(scored["phonemes"]) == 2
    assert scored["analysis"]["audio_detected"] is True
    assert scored["analysis"]["alignment_status"] == "mfa"
    assert scored["overall_score"] >= 75


def test_score_pronunciation_handles_empty_phones(monkeypatch):
    monkeypatch.setattr(
        "app.services.pronunciation.scorer.run_pronunciation_engine",
        lambda *_args, **_kwargs: {
            "alignment": {"alignment_status": "mocked", "segments": [{"text": "hello"}], "phones": [], "engine_meta": {}},
            "phoneme_map": [],
            "features": {"audio_penalty": 0, "energy": 0.95, "rhythm": 0.95, "word_count": 1, "estimated_duration_ms": 360},
        },
    )
    scored = score_pronunciation("sid-2", "hello", None)
    assert scored["phonemes"] == []
    assert scored["analysis"]["audio_detected"] is False
    assert scored["words"][0]["status"] in {"good", "warning"}
