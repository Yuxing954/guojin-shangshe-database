import datetime as dt
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_daily_report import scheduled_cutoff, window_hours


class DailyCutoffTests(unittest.TestCase):
    def test_new_schedule_preserves_historical_cutoffs(self):
        self.assertEqual(scheduled_cutoff(dt.date(2026, 10, 18)).isoformat(), '2026-10-18T16:00:00+08:00')
        self.assertEqual(scheduled_cutoff(dt.date(2026, 10, 19)).isoformat(), '2026-10-19T18:00:00+08:00')

    def test_monday_window_starts_friday_evening(self):
        cutoff = scheduled_cutoff(dt.date(2026, 10, 19))
        self.assertEqual((cutoff - dt.timedelta(hours=window_hours(cutoff))).isoformat(), '2026-10-16T18:00:00+08:00')

    def test_other_dates_use_previous_evening(self):
        cutoff = scheduled_cutoff(dt.date(2026, 10, 20))
        self.assertEqual((cutoff - dt.timedelta(hours=window_hours(cutoff))).isoformat(), '2026-10-19T18:00:00+08:00')
