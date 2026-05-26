def generate_tips(result: dict) -> list[str]:
    tips: list[str] = []
    warning_words = [word["text"].lower() for word in result["words"] if word["status"] != "good"]

    if any(word in warning_words for word in ["name", "anna"]):
        tips.append("Open vowels more clearly on stressed words.")
    if len(warning_words) >= 2:
        tips.append("Slow down slightly so each important word gets a cleaner ending sound.")
    if not tips:
        tips.append("Keep a steady rhythm through the full sentence.")

    tips.append("Practice the sentence again with smoother pacing from the middle to the end.")
    return tips
