"""The Firestore-backed quota store, run through the real google-cloud-firestore client.

Only the gRPC layer is replaced by a tiny in-memory server (begin / batch_get / commit / rollback),
so the real `transactional` decorator, document references and field serialisation are exercised.
No network, no emulator, no production project.
"""

from datetime import datetime, timezone

import pytest
from google.api_core import exceptions as gexc
from google.auth.credentials import AnonymousCredentials
from google.cloud import firestore
from google.cloud.firestore_v1 import _helpers
from google.cloud.firestore_v1.types import firestore as firestore_pb
from google.cloud.firestore_v1.types import write as write_pb
from google.protobuf import timestamp_pb2

import quota

DB = "projects/test-project/databases/(default)/documents"
EXPIRE_AT = datetime(2026, 10, 11, 0, 0, tzinfo=timezone.utc)


class FakeFirestoreServer:
    """Just enough of the Firestore gapic API for one document read + one write per transaction."""

    def __init__(self) -> None:
        self.docs = {}  # full document name -> Document proto
        self.commits = 0
        self.writes = 0
        self.rollbacks = 0
        self.begins = 0
        self.abort_next_commits = 0  # simulate contention: the first N commits are aborted

    def begin_transaction(self, request, metadata=None, **_):
        self.begins += 1
        return firestore_pb.BeginTransactionResponse(transaction=b"tx-%d" % self.begins)

    def batch_get_documents(self, request, metadata=None, **_):
        for name in request["documents"]:
            now = timestamp_pb2.Timestamp(seconds=1)
            if name in self.docs:
                yield firestore_pb.BatchGetDocumentsResponse(
                    found=self.docs[name], transaction=request.get("transaction", b""), read_time=now
                )
            else:
                yield firestore_pb.BatchGetDocumentsResponse(
                    missing=name, transaction=request.get("transaction", b""), read_time=now
                )

    def commit(self, request, metadata=None, **_):
        if self.abort_next_commits:
            self.abort_next_commits -= 1
            raise gexc.Aborted("contention")
        self.commits += 1
        for write in request["writes"]:
            self.writes += 1
            self.docs[write.update.name] = write.update
        results = [_write_result() for _ in request["writes"]]
        return firestore_pb.CommitResponse(
            write_results=results, commit_time=timestamp_pb2.Timestamp(seconds=2)
        )

    def rollback(self, request, metadata=None, **_):
        self.rollbacks += 1


def _write_result():
    return write_pb.WriteResult(update_time=timestamp_pb2.Timestamp(seconds=2))


@pytest.fixture
def server():
    return FakeFirestoreServer()


@pytest.fixture
def store(server, monkeypatch):
    client = firestore.Client(project="test-project", credentials=AnonymousCredentials())
    client._firestore_api_internal = server
    s = quota.FirestoreQuotaStore()
    monkeypatch.setattr(s, "_get_client", lambda: client)
    return s


def stored(server, doc_id):
    doc = server.docs[f"{DB}/llmQuota/{doc_id}"]
    return _helpers.decode_dict(doc.fields, None)


def test_first_call_creates_the_document_with_count_and_expire_at(store, server):
    assert store.try_consume("uid-1_2026-10-09", 10, EXPIRE_AT) is True
    data = stored(server, "uid-1_2026-10-09")
    assert data["count"] == 1
    assert data["expireAt"] == EXPIRE_AT  # stored as a Firestore timestamp, as TTL requires


def test_count_is_incremented_up_to_the_limit_then_refused(store, server):
    results = [store.try_consume("uid-1_2026-10-09", 3, EXPIRE_AT) for _ in range(5)]
    assert results == [True, True, True, False, False]
    assert stored(server, "uid-1_2026-10-09")["count"] == 3
    assert server.writes == 3  # refused calls write nothing


def test_other_user_or_day_has_its_own_document(store, server):
    assert store.try_consume("uid-1_2026-10-09", 1, EXPIRE_AT) is True
    assert store.try_consume("uid-1_2026-10-09", 1, EXPIRE_AT) is False
    assert store.try_consume("uid-1_2026-10-10", 1, EXPIRE_AT) is True
    assert store.try_consume("uid-2_2026-10-09", 1, EXPIRE_AT) is True


def test_transaction_is_retried_when_firestore_aborts_it(store, server):
    server.abort_next_commits = 2
    assert store.try_consume("uid-1_2026-10-09", 10, EXPIRE_AT) is True
    assert stored(server, "uid-1_2026-10-09")["count"] == 1  # counted once, not once per retry
    assert server.begins == 3


def test_constructing_the_store_does_not_touch_firebase():
    quota.FirestoreQuotaStore()
