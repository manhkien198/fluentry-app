from app.services.lesson_rubric import compute_lesson_rubric


def test_rubric_has_expected_structure():
    rubric = compute_lesson_rubric("Intermediate", "I think the project will improve our delivery rhythm.")
    assert rubric.cefr == "B1"
    assert 20 <= rubric.complexity_score <= 100
    assert 0 <= rubric.phoneme_coverage <= 100
    assert 20 <= rubric.fluency_demand <= 100


def test_level_to_cefr_mapping():
    assert compute_lesson_rubric("Beginner", "Simple sentence for level.").cefr == "A2"
    assert compute_lesson_rubric("Advanced", "Complex strategic articulation for executives.").cefr == "B2"
