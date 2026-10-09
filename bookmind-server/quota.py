"""Daily per-user quota on LLM calls, stored in Firestore.

One document per user per UTC day: ``llmQuota/{uid}_{YYYY-MM-DD}`` with

- ``count``     calls made that day, incremented in a transaction BEFORE the LLM is called;
- ``expireAt``  start of the next UTC day + 24 h. A Firestore TTL policy on this field deletes
                the document (the operator enables it once: see the README).

When ``count`` has already reached ``DAILY_LLM_CALL_LIMIT`` (default 10) the request is refused
with 429 and the LLM is not called. A failed LLM call is not refunded. If Firestore cannot be
reached the request is refused with 503 (fail closed): without a counter there is no budget cap.
"""

import logging
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional, Protocol

from fastapi import HTTPException, status
from firebase_admin import firestore
from google.cloud.firestore_v1 import DocumentReference, Transaction

from auth import get_firebase_app

logger = logging.getLogger("bookmind.quota")

COLLECTION = "llmQuota"
DEFAULT_DAILY_LIMIT = 10


def get_daily_limit() -> int:
    """DAILY_LLM_CALL_LIMIT from the environment (default 10). Invalid values use the default."""
    raw = os.getenv("DAILY_LLM_CALL_LIMIT")
    if raw is None or not raw.strip():
        return DEFAULT_DAILY_LIMIT
    try:
        value = int(raw.strip())
    except ValueError:
        logger.warning("DAILY_LLM_CALL_LIMIT is not an integer, using %d", DEFAULT_DAILY_LIMIT)
        return DEFAULT_DAILY_LIMIT
    if value < 0:
        logger.warning("DAILY_LLM_CALL_LIMIT is negative, using %d", DEFAULT_DAILY_LIMIT)
        return DEFAULT_DAILY_LIMIT
    return value


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def quota_document_id(uid: str, now: datetime) -> str:
    return f"{uid}_{now.astimezone(timezone.utc).strftime('%Y-%m-%d')}"


def quota_expire_at(now: datetime) -> datetime:
    """Start of the next UTC day plus 24 h."""
    day_start = now.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return day_start + timedelta(days=1) + timedelta(hours=24)


def _seconds_until_next_utc_day(now: datetime) -> int:
    day_start = now.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((day_start + timedelta(days=1) - now).total_seconds()))


class QuotaStore(Protocol):
    def try_consume(self, doc_id: str, limit: int, expire_at: datetime) -> bool:
        """Atomically count one call. Return False, changing nothing, if `limit` is reached."""


def _increment_if_below_limit(
    transaction: Transaction, ref: DocumentReference, limit: int, expire_at: datetime
) -> bool:
    snapshot = ref.get(transaction=transaction)
    count = int((snapshot.to_dict() or {}).get("count", 0)) if snapshot.exists else 0
    if count >= limit:
        return False
    transaction.set(ref, {"count": count + 1, "expireAt": expire_at})
    return True


_increment_in_transaction = firestore.transactional(_increment_if_below_limit)


class FirestoreQuotaStore:
    def __init__(self) -> None:
        self._client = None
        self._lock = threading.Lock()

    def _get_client(self):
        with self._lock:
            if self._client is None:
                self._client = firestore.client(get_firebase_app())
            return self._client

    def try_consume(self, doc_id: str, limit: int, expire_at: datetime) -> bool:
        client = self._get_client()
        ref = client.collection(COLLECTION).document(doc_id)
        return _increment_in_transaction(client.transaction(), ref, limit, expire_at)


_store: Optional[QuotaStore] = None
_store_lock = threading.Lock()


def get_quota_store() -> QuotaStore:
    """FastAPI dependency. Tests override it with an in-memory store."""
    global _store
    with _store_lock:
        if _store is None:
            _store = FirestoreQuotaStore()
        return _store


def consume_llm_call(store: QuotaStore, uid: str) -> None:
    """Count one LLM call for `uid` today. Raise 429 over the limit, 503 if the store fails."""
    now = _utcnow()
    try:
        allowed = store.try_consume(
            quota_document_id(uid, now), get_daily_limit(), quota_expire_at(now)
        )
    except Exception as exc:
        logger.error("Quota store unavailable: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Quota service unavailable",
        )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily limit reached",
            headers={"Retry-After": str(_seconds_until_next_utc_day(now))},
        )
