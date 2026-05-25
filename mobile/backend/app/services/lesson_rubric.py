from __future__ import annotations

import re

from app.schemas.lesson import LessonRubric


def compute_lesson_rubric(level: str, prompt: str) -> LessonRubric:
    words = re.findall(r"[A-Za-z']+", prompt)
    word_count = len(words)
    avg_len = (sum(len(w) for w in words) / word_count) if word_count else 0
    punctuation_bonus = min(10, sum(prompt.count(ch) for ch in ",;:-"))
    complexity = min(100, int(word_count * 3 + avg_len * 5 + punctuation_bonus))

    lowered = prompt.lower()
    phoneme_hits = 0
    if "th" in lowered:
        phoneme_hits += 34
    if "r" in lowered:
        phoneme_hits += 33
    if "l" in lowered:
        phoneme_hits += 33

    fluency_demand = min(100, int(word_count * 4 + punctuation_bonus * 2))

    cefr = {"Beginner": "A2", "Intermediate": "B1", "Advanced": "B2"}.get(level, "B1")
    return LessonRubric(
        cefr=cefr,
        complexity_score=max(20, complexity),
        phoneme_coverage=min(100, phoneme_hits),
        fluency_demand=max(20, fluency_demand),
    )
