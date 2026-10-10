"""Where reports of AI-generated content are written: one structured Cloud Logging entry each.

A report is never stored in a datastore. ``POST /reports`` hands a small dict (kind, lang, content,
reason: no UID, no transcript) to a ``ReportSink``. The production sink writes it to the Cloud
Logging log ``ai-content-report`` with severity WARNING, so it is read in Logs Explorer with
``logName="projects/<project>/logs/ai-content-report"`` and expires with the ``_Default`` bucket
retention (30 days) like every other log. Nothing here ever sees the caller's identity.

The Cloud Logging API call needs ``roles/logging.logWriter`` on the service account (DEPLOY.md).

``REPORT_LOG_DESTINATION=stdout`` prints the same entry as one JSON line instead. It is for local
development only: on Cloud Run it would land in the ``run.googleapis.com/stdout`` log, not in
``ai-content-report``.
"""

import json
import os
import sys
import threading
from typing import Any, Dict, Optional, Protocol

LOG_NAME = "ai-content-report"
SEVERITY = "WARNING"
DESTINATION_ENV = "REPORT_LOG_DESTINATION"


class ReportSink(Protocol):
    def write(self, entry: Dict[str, Any]) -> None:
        """Write exactly one log entry. Raise if it could not be written."""


class CloudLoggingReportSink:
    """Synchronous write to Cloud Logging, so a failure is visible and the request can fail."""

    def __init__(self) -> None:
        self._logger = None
        self._lock = threading.Lock()

    def _get_logger(self):
        with self._lock:
            if self._logger is None:
                # Imported here: the module (and `import main`) must not need Google credentials.
                import google.cloud.logging_v2 as logging_v2
                from google.cloud import logging as cloud_logging

                # By default the library writes one extra diagnostic entry (its own name and
                # version, no user data) to the first log it is used with, per process. Mark it
                # as already sent so `ai-content-report` holds one entry per report and nothing
                # else. If a library upgrade renames this flag the extra entry simply comes back
                # (the real-library test in tests/test_reports.py fails then).
                logging_v2._instrumentation_emitted = True

                project = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
                client = cloud_logging.Client(project=project or None)
                self._logger = client.logger(LOG_NAME)
            return self._logger

    def write(self, entry: Dict[str, Any]) -> None:
        self._get_logger().log_struct(entry, severity=SEVERITY)


class StdoutReportSink:
    """Local development: one JSON line on stdout."""

    def write(self, entry: Dict[str, Any]) -> None:
        sys.stdout.write(json.dumps({"logName": LOG_NAME, "severity": SEVERITY, **entry}) + "\n")
        sys.stdout.flush()


_sink: Optional[ReportSink] = None
_sink_lock = threading.Lock()


def get_report_sink() -> ReportSink:
    """FastAPI dependency. Tests override it with a recording sink."""
    global _sink
    with _sink_lock:
        if _sink is None:
            if os.getenv(DESTINATION_ENV, "").strip().lower() == "stdout":
                _sink = StdoutReportSink()
            else:
                _sink = CloudLoggingReportSink()
        return _sink
