# -*- coding: utf-8 -*-
"""Regression coverage for the dependency-light task schedule policy."""

from __future__ import annotations

from datetime import datetime, timezone
import unittest

from py.task_schedule_policy import (
    collect_due_task_executions,
    compute_next_run_from_expression,
    project_missing_recurring_runs,
)


class TaskSchedulePolicyTests(unittest.TestCase):
    """Validate deterministic projection and due-task selection."""

    def test_computes_rrule_and_natural_intervals(self) -> None:
        """Compute supported expressions without importing the executor stack."""

        reference = datetime(2026, 7, 23, 10, 15, 30)
        self.assertEqual(
            compute_next_run_from_expression("FREQ=MINUTELY;INTERVAL=5", reference),
            datetime(2026, 7, 23, 10, 20, 30),
        )
        self.assertEqual(
            compute_next_run_from_expression("every 2 hours", reference),
            datetime(2026, 7, 23, 12, 15, 30),
        )
        self.assertIsNone(compute_next_run_from_expression("unsupported", reference))

    def test_handles_prefixed_weekly_and_invalid_rrules(self) -> None:
        """Keep common RRULE forms deterministic and reject invalid time fields."""

        reference = datetime(2026, 7, 23, 10, 15, 30)
        self.assertEqual(
            compute_next_run_from_expression(
                "RRULE:FREQ=WEEKLY;BYDAY=TH;BYHOUR=11;BYMINUTE=0",
                reference,
            ),
            datetime(2026, 7, 23, 11, 0, 0),
        )
        self.assertIsNone(compute_next_run_from_expression(
            "FREQ=DAILY;BYHOUR=99",
            reference,
        ))
        self.assertIsNone(compute_next_run_from_expression(
            "every 999999999999999999999 weeks",
            reference,
        ))

    def test_projects_missing_recurring_runs(self) -> None:
        """Return a next run or bounded error for missing recurring metadata."""

        reference = datetime(2026, 7, 23, 10, 0, 0)
        projections = project_missing_recurring_runs([
            {
                "task_id": "valid",
                "context": {"schedule_type": "recurring", "schedule_expression": "hourly"},
            },
            {
                "task_id": "invalid",
                "context": {"schedule_type": "recurring", "schedule_expression": "later"},
            },
        ], reference)
        self.assertEqual(projections[0].next_run_at, "2026-07-23T11:00:00")
        self.assertEqual(projections[0].error, "")
        self.assertIsNone(projections[1].next_run_at)
        self.assertIn("supported schedule expression", projections[1].error)

    def test_selects_due_tasks_and_suppresses_recent_activation(self) -> None:
        """Select due tasks once while preserving recurring next-run metadata."""

        reference = datetime(2026, 7, 23, 10, 0, 0, tzinfo=timezone.utc)
        decisions = collect_due_task_executions([
            {
                "task_id": "once-due",
                "status": "pending",
                "context": {"schedule_type": "once", "next_run_at": "2026-07-23T09:59:00Z"},
            },
            {
                "task_id": "recurring-due",
                "status": "completed",
                "context": {
                    "schedule_type": "recurring",
                    "schedule_expression": "every 5 minutes",
                    "next_run_at": "2026-07-23T09:58:00Z",
                },
            },
            {
                "task_id": "recently-queued",
                "status": "pending",
                "context": {
                    "schedule_type": "once",
                    "next_run_at": "2026-07-23T09:59:00Z",
                    "activation_requested_at": "2026-07-23T09:59:30Z",
                },
            },
        ], reference)
        self.assertEqual([decision.task_id for decision in decisions], [
            "recurring-due",
            "once-due",
        ])
        self.assertEqual(decisions[0].next_run_at, "2026-07-23T10:05:00+00:00")
        self.assertIsNone(decisions[1].next_run_at)


if __name__ == "__main__":
    unittest.main()
