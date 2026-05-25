def phonemize_text(expected_text: str) -> list[dict[str, str | list[str]]]:
    return [
        {
            "word": word,
            "phonemes": [char.upper() for char in word[: min(len(word), 4)]],
        }
        for word in expected_text.replace('.', '').replace('?', '').split()
    ]
