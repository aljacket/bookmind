"""Automatic quality checks for the LLM-provider evaluation (card #71).

Pure functions, no network. The checks are heuristics that approximate the card's rubric; the
operator's blind rating is the human counterpart. Each check is deliberately simple so its failures
can be explained in the report:

- language:  stop-word vote between it / en / es.
- citation:  the reason shares at least one word stem (first 5 letters, stop words and words shorter
             than 4 letters removed) with what the reader wrote or with the loved-books list.
- clarifier: exactly one question mark, fewer than 25 words, no genre vocabulary.
- already-read: no recommended title matches a title in `liked_books`.
"""

import json
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Dict, Iterable, List, Optional, Sequence, Set

STOPWORDS: Dict[str, Set[str]] = {
    "it": set(
        "che di il la le lo gli per con una un uno non è e sono hai ho ti mi ci si come più dei del della delle "
        "nel nella alla al ma anche questo questa questi perché se da in su tra fra libro libri lettura ai agli "
        "nei sul sulla dal dalla poi molto così quindi essere avere sei suo sua tuo tua tuoi ha hanno".split()
    ),
    "en": set(
        "the and of to a an is you your with for that this in it as are but have has book books who from about "
        "on at by be was were will can if or not so its their they them he she his her what which when where".split()
    ),
    "es": set(
        "el la los las de que y un una es con para por tu te su del como más pero libro libros en se lo al "
        "mi me si ya muy también esta este estos estas sobre entre desde hasta cuando donde qué son fue".split()
    ),
}
# Words that are specific to one language (the generic stop words above overlap between it and es).
DISCRIMINATING: Dict[str, Set[str]] = {
    "it": set("che è sono hai ti della delle dei degli gli nel nella alla perché più anche questo questa per il le non ma ho ci".split()),
    "en": set("the and your you with that this are have book about from for of to is".split()),
    "es": set("que es los las del para por tu te su pero más también esta este el y en muy ya".split()),
}
ALL_STOP: Set[str] = set().union(*STOPWORDS.values())

GENRE_RE = {
    "it": re.compile(r"\bgener[ei]\b|\bsottogener[ei]\b", re.IGNORECASE),
    "en": re.compile(r"\bgenres?\b", re.IGNORECASE),
    "es": re.compile(r"\bg[eé]neros?\b", re.IGNORECASE),
}


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def normalize(text: str) -> str:
    text = strip_accents(text).lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokens(text: str) -> List[str]:
    return re.findall(r"[a-zà-ÿ]+", text.lower())


def language_scores(text: str) -> Dict[str, int]:
    toks = tokens(text)
    return {lang: sum(1 for t in toks if t in words) for lang, words in DISCRIMINATING.items()}


def language_ok(text: str, expected: str) -> bool:
    """True when the expected language has the highest (or tied-highest) stop-word score and > 0."""
    scores = language_scores(text)
    best = max(scores.values())
    return scores[expected] > 0 and scores[expected] >= best


def stems(text: str) -> Set[str]:
    out = set()
    for tok in tokens(strip_accents(text)):
        if len(tok) >= 4 and tok not in ALL_STOP:
            out.add(tok[:5])
    return out


def reason_cites_reader(reason: str, reader_text: str) -> bool:
    return bool(stems(reason) & stems(reader_text))


def clarifier_checks(question: str, lang: str, off_topic: bool) -> Dict[str, bool]:
    text = question.strip()
    words = text.split()
    return {
        # With response_format json_object on this endpoint some models answer a JSON object, which the
        # app would show verbatim.
        "plain_text": not text.startswith(("{", "[", "```")),
        "single_question": text.count("?") == 1 and "\n" not in text,
        "under_25_words": len(words) < 25,
        "not_about_genre": True if off_topic else not GENRE_RE[lang].search(text),
        "language": language_ok(text, lang),
    }


def _title_core(title: str) -> str:
    # Drop a subtitle after ':' or ' - ' or a trailing parenthesis, which models add inconsistently.
    return re.split(r"\s[-–—]\s|:|\(", title)[0].strip()


_ARTICLES = {"il", "lo", "la", "i", "gli", "le", "un", "una", "the", "a", "an", "el", "los", "las", "l"}


def title_key(title: str) -> str:
    toks = [t for t in normalize(_title_core(title)).split() if t not in _ARTICLES]
    return " ".join(toks)


def titles_match(a: str, b: str, threshold: float = 0.82) -> bool:
    ka, kb = title_key(a), title_key(b)
    if not ka or not kb:
        return False
    if ka == kb:
        return True
    return SequenceMatcher(None, ka, kb).ratio() >= threshold


def surname(author: str) -> str:
    """Last significant token of an author name ('J. K. Rowling' -> 'rowling', 'de Giovanni' -> 'giovanni')."""
    toks = [t for t in normalize(author).split() if len(t) > 1]
    return toks[-1] if toks else ""


def author_matches(model_author: str, candidates: Iterable[str]) -> bool:
    sur = surname(model_author)
    if not sur:
        return False
    return any(sur in normalize(c).split() or sur in normalize(c) for c in candidates)


def already_read(title: str, liked_books: Sequence[Dict[str, str]]) -> bool:
    return any(titles_match(title, lb["title"]) for lb in liked_books)


def lenient_json(content: str) -> Optional[dict]:
    """Diagnostic only: would the answer parse after stripping markdown fences or surrounding prose?

    The production parser is strict `json.loads`; this tells the report whether a failure is cosmetic.
    """
    text = content.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None
