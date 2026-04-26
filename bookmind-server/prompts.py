"""Prompt builders for the conversational recommendation flow.

Two LLM calls per session:
- clarifier: given (T1=opener answer, T2=anchor answer), return one focused follow-up question
- recommendation: given the full transcript (2 or 3 turns), return 3 books with grounded reasons

The LLM only sees user-authored content rendered as labeled lines. Role metadata on the
TranscriptTurn is reserved for forward-compat but not currently used in prompt assembly.
"""

from typing import Literal

SupportedLang = Literal["en", "es", "it"]

CLARIFIER_SYSTEM_PROMPT = (
    "You are a librarian helping a reader narrow down what to read next. "
    "You will receive two short answers from the reader: (1) what they're in the mood for, "
    "and (2) a book they recently loved or hated and what stuck with them. "
    "Your job is to ask EXACTLY ONE follow-up question to disambiguate. "
    "Probe a dimension the reader has not already covered: length / time commitment, "
    "tone or mood (cozy vs. intense, hopeful vs. dark), or familiarity vs. novelty "
    "(close to what they liked vs. a stretch). "
    "Do NOT ask about genre — they already told you. "
    "Do NOT ask multiple questions or add commentary. "
    "Output ONLY the question, in the requested language, in one sentence under 25 words. "
    "If the reader's input is off-topic or not about books, gently steer them back by asking "
    "what kind of book they want."
)

RECOMMENDATION_SYSTEM_PROMPT = (
    "You are a book recommendation expert. You will receive a short transcript of a reader "
    "describing what they want to read. Recommend exactly 3 real, published books that match "
    "the transcript. Each `reason` MUST cite or paraphrase a specific phrase the reader used "
    "— never a generic blurb. Reasons are one sentence, in the requested language. "
    "Only recommend books — if the transcript is off-topic, redirect by recommending 3 "
    "widely-loved books and saying so in the reasons. Always return the exact JSON format requested."
)

_LANG_LABELS: dict[SupportedLang, dict[str, str]] = {
    "en": {
        "opener_label": "Reader's mood",
        "anchor_label": "A book they loved or hated and what stuck with them",
        "clarifier_label": "Their answer to the follow-up",
        "instruction_clarifier": "Ask one focused follow-up question in English.",
        "instruction_recommend": (
            "Return exactly 3 books in this JSON shape: "
            '{"b":[{"t":"title","a":"author","r":"one-sentence reason citing the reader\'s own words"}]}. '
            "Reasons must be in English. Return ONLY the JSON, no prose."
        ),
    },
    "es": {
        "opener_label": "Estado de ánimo del lector",
        "anchor_label": "Un libro que amó u odió y qué se le quedó",
        "clarifier_label": "Su respuesta al seguimiento",
        "instruction_clarifier": "Haz una pregunta de seguimiento concreta en español.",
        "instruction_recommend": (
            "Devuelve exactamente 3 libros con esta forma JSON: "
            '{"b":[{"t":"título","a":"autor","r":"razón en una frase citando palabras del lector"}]}. '
            "Las razones deben estar en español. Devuelve SOLO el JSON, sin texto adicional."
        ),
    },
    "it": {
        "opener_label": "Stato d'animo del lettore",
        "anchor_label": "Un libro amato o odiato e cosa gli è rimasto",
        "clarifier_label": "La sua risposta al follow-up",
        "instruction_clarifier": "Fai una domanda di follow-up mirata in italiano.",
        "instruction_recommend": (
            "Ritorna esattamente 3 libri in questa forma JSON: "
            '{"b":[{"t":"titolo","a":"autore","r":"motivazione in una frase che cita le parole del lettore"}]}. '
            "Le motivazioni devono essere in italiano. Ritorna SOLO il JSON, senza altro testo."
        ),
    },
}


def _format_body(lang: SupportedLang, user_messages: list[str]) -> str:
    labels = _LANG_LABELS[lang]
    lines = [
        f"{labels['opener_label']}: {user_messages[0]}",
        f"{labels['anchor_label']}: {user_messages[1]}",
    ]
    if len(user_messages) >= 3:
        lines.append(f"{labels['clarifier_label']}: {user_messages[2]}")
    return "\n".join(lines)


def build_clarifier_prompt(lang: SupportedLang, user_messages: list[str]) -> str:
    """Build the user-message content for the clarifier LLM call. Expects exactly 2 user messages."""
    if len(user_messages) != 2:
        raise ValueError("clarifier expects exactly 2 user messages (opener, anchor)")
    body = _format_body(lang, user_messages)
    instruction = _LANG_LABELS[lang]["instruction_clarifier"]
    return f"{body}\n\n{instruction}"


def build_recommendation_prompt(lang: SupportedLang, user_messages: list[str]) -> str:
    """Build the user-message content for the recommendation LLM call. Expects 2 or 3 user messages."""
    if not 2 <= len(user_messages) <= 3:
        raise ValueError("recommendation expects 2 or 3 user messages")
    body = _format_body(lang, user_messages)
    instruction = _LANG_LABELS[lang]["instruction_recommend"]
    return f"{body}\n\n{instruction}"