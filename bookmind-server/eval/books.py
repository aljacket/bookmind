"""Does a recommended book exist? Title + author lookup against public catalogues.

Cascade, first hit wins:

1. Google Books (`volumes?q=intitle:...+inauthor:...`), only when `GOOGLE_BOOKS_API_KEY` is set.
   Without a key the anonymous quota of the shared project is 0 (HTTP 429, checked 2026-10-09),
   so the cascade skips it. This is the card's required source: add the key to `.env` and re-run
   `score.py --refresh-books` to re-verify every book against it.
2. Open Library search by title and author.
3. OPAC SBN, the Italian national library catalogue (no key), added on 2026-10-10 after QA.
4. Wikidata item search by label or alias (it, en, es); the description must name the author.
5. Wikipedia search (it, en, es) for the title and the author.

A book is "verified" when a catalogue entry matches the title (fuzzy, articles and subtitles
ignored) and the author's surname. Everything else is "unverified", which in this report means
"could not be found", not "proven invented": the list of unverified titles is printed so a human can
judge them. Results are cached on disk, so scoring is repeatable and polite to the services.
"""

import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from checks import author_matches, normalize, surname, title_key, titles_match

USER_AGENT = "bookmind-eval/1.0 (offline provider evaluation; contact: repo owner)"


def _get_json(url: str, retries: int = 3) -> Optional[Dict[str, Any]]:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=25) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503) and attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            return None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            time.sleep(1)
    return None


def _has_latin(names: List[str]) -> bool:
    return any(any("a" <= c.lower() <= "z" for c in n) for n in names)


class BookVerifier:
    def __init__(self, cache_path: Path, google_key: Optional[str] = None, pause_s: float = 0.2) -> None:
        self.cache_path = cache_path
        self.google_key = google_key or os.environ.get("GOOGLE_BOOKS_API_KEY")
        self.pause_s = pause_s
        self._lock = threading.Lock()
        self._new = 0
        self.cache: Dict[str, Dict[str, Any]] = {}
        if cache_path.exists():
            self.cache = json.loads(cache_path.read_text(encoding="utf-8"))

    @staticmethod
    def key(title: str, author: str) -> str:
        return f"{title_key(title)}|{surname(author)}"

    LABELS = {"R": "real", "T": "title_off", "I": "invented", "U": "unsure"}

    def load_review(self, path: Path) -> None:
        """Manual review of the books no catalogue found, from a tab-separated file with the columns
        `label  title  author  note` (first line is the header).

        R = real (exists, with the title as given or the official one), T = title_off (a real book whose
        title is mangled, not the official translation, or whose author is wrong), I = invented,
        U = unsure (not recognised, counted as not existing). The reviewer is the backend-engineer
        agent, from its own knowledge of the literature: the list is committed so a human can audit it.
        """
        self.review: Dict[str, Dict[str, str]] = {}
        if not path.exists():
            return
        for line in path.read_text(encoding="utf-8").splitlines()[1:]:
            parts = line.split("\t")
            if len(parts) < 3 or parts[0] not in self.LABELS:
                continue
            self.review[self.key(parts[1], parts[2])] = {"label": self.LABELS[parts[0]], "note": parts[3] if len(parts) > 3 else ""}

    def status(self, title: str, author: str) -> str:
        """found (catalogue) | real | title_off | invented | unsure (manual review) | not_found."""
        k = self.key(title, author)
        entry = self.cache.get(k)
        if entry and entry["verified"]:
            return "found"
        review = getattr(self, "review", {}).get(k)
        return review["label"] if review else "not_found"

    def save(self) -> None:
        with self._lock:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            self.cache_path.write_text(json.dumps(self.cache, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")

    def verify(self, title: str, author: str, refresh: bool = False) -> Dict[str, Any]:
        k = self.key(title, author)
        if not refresh and k in self.cache:
            return self.cache[k]
        result = (
            self._google(title, author)
            or self._open_library(title, author)
            or self._sbn(title, author)
            or self._wikidata(title, author)
            or self._wikipedia(title, author)
            or {"verified": False, "source": None}
        )
        result["example"] = {"title": title, "author": author}
        with self._lock:
            self.cache[k] = result
            self._new += 1
            flush = self._new % 25 == 0
        if flush:  # a long run must not lose its lookups if it is interrupted
            self.save()
        return result

    def recheck_sbn(self, title: str, author: str) -> bool:
        """Ask only OPAC SBN about a book cached as not found; update the cache on a hit."""
        hit = self._sbn(title, author)
        if hit:
            hit["example"] = {"title": title, "author": author}
            with self._lock:
                self.cache[self.key(title, author)] = hit
        return bool(hit)

    # --- sources -------------------------------------------------------------------------------

    def _google(self, title: str, author: str) -> Optional[Dict[str, Any]]:
        if not self.google_key:
            return None
        params = {"q": f'intitle:"{title}" inauthor:"{author}"', "maxResults": "5", "key": self.google_key}
        data = _get_json("https://www.googleapis.com/books/v1/volumes?" + urllib.parse.urlencode(params))
        time.sleep(self.pause_s)
        for item in (data or {}).get("items", []):
            info = item.get("volumeInfo", {})
            if titles_match(title, info.get("title", "")) and author_matches(author, info.get("authors", [])):
                return {"verified": True, "source": "google_books", "matched": info.get("title")}
        return None

    def _open_library(self, title: str, author: str) -> Optional[Dict[str, Any]]:
        queries = [
            {"title": title, "author": author},
            {"q": f"{title} {author}"},
            {"title": title},
        ]
        for params in queries:
            params = dict(params, limit="8", fields="title,author_name,author_alternative_name")
            data = _get_json("https://openlibrary.org/search.json?" + urllib.parse.urlencode(params))
            time.sleep(self.pause_s)
            for doc in (data or {}).get("docs", []):
                if not titles_match(title, doc.get("title", "")):
                    continue
                names = list(doc.get("author_name", [])) + list(doc.get("author_alternative_name", []))
                # Authors catalogued only in a non-Latin script cannot be matched by surname: accept
                # an exact title in that case.
                if author_matches(author, names) or (names and not _has_latin(names) and title_key(title) == title_key(doc["title"])):
                    return {"verified": True, "source": "open_library", "matched": doc.get("title")}
        return None

    def _sbn(self, title: str, author: str) -> Optional[Dict[str, Any]]:
        """OPAC SBN (Italian national library catalogue, no key): authoritative for Italian editions."""
        sur = surname(author)
        words = " ".join(w for w in normalize(title).split() if len(w) > 1)
        if not words or not sur:
            return None
        params = {"any": f"{words} {sur}", "type": "0", "rows": "12"}
        data = _get_json("https://opac.sbn.it/opacmobilegw/search.json?" + urllib.parse.urlencode(params))
        time.sleep(self.pause_s)
        for rec in (data or {}).get("briefRecords", []):
            record_title = rec.get("titolo", "").split(" / ")[0]
            if titles_match(title, record_title) and sur in normalize(rec.get("autorePrincipale", "")).split():
                return {"verified": True, "source": "sbn", "matched": record_title}
        return None

    def _wikidata(self, title: str, author: str) -> Optional[Dict[str, Any]]:
        """Wikidata item search by label or alias in it/en/es. Italian translations of foreign books
        are usually labelled there, which Open Library's catalogue does not index."""
        sur = surname(author)
        for lang in ("it", "en", "es"):
            params = {
                "action": "wbsearchentities",
                "search": title,
                "language": lang,
                "uselang": lang,
                "type": "item",
                "limit": "8",
                "format": "json",
            }
            data = _get_json("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(params))
            time.sleep(self.pause_s)
            for hit in (data or {}).get("search", []):
                names = [hit.get("label", ""), (hit.get("match") or {}).get("text", "")]
                if any(n and titles_match(title, n) for n in names) and sur in normalize(hit.get("description", "")).split():
                    return {"verified": True, "source": f"wikidata_{lang}", "matched": hit.get("label")}
        return None

    def _wikipedia(self, title: str, author: str) -> Optional[Dict[str, Any]]:
        sur = surname(author)
        for lang in ("it", "en", "es"):
            params = {
                "action": "query",
                "list": "search",
                "srsearch": f"{title} {author}",
                "srlimit": "4",
                "format": "json",
            }
            data = _get_json(f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params))
            time.sleep(self.pause_s)
            for hit in ((data or {}).get("query") or {}).get("search", []):
                snippet = normalize(hit.get("snippet", "").replace("<span class=\"searchmatch\">", "").replace("</span>", ""))
                name = normalize(hit.get("title", ""))
                book_page = titles_match(title, hit.get("title", "")) and sur in (snippet + " " + name)
                author_page = sur in name.split() and normalize(title) and normalize(title) in snippet
                if book_page or author_page:
                    return {"verified": True, "source": f"wikipedia_{lang}", "matched": hit.get("title")}
        return None
