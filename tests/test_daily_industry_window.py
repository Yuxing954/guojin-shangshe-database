import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from validate_daily_editorial import validate_industry_updates

class IndustryWindowTests(unittest.TestCase):
 def report(self, published):
  return {'industryWindowHours': 24,
          'industryWindowStart': '2026-10-13T21:31:03+08:00',
          'industryWindowEnd': '2026-10-14T21:31:03+08:00',
          'industryUpdates': [{'publishedAt': published, 'availableAt': '2026-10-14T21:31:03+08:00'}]}

 def test_daytime_and_authorized_evening_releases_are_valid(self):
  for published in ('2026-10-14T09:30:00+08:00', '2026-10-14T20:30:00+08:00'):
   validate_industry_updates(self.report(published))

 def test_new_ingestion_does_not_refresh_old_publication(self):
  with self.assertRaisesRegex(AssertionError, 'outside publication window'):
   validate_industry_updates(self.report('2026-10-12T09:30:00+08:00'))

 def test_missing_or_ambiguous_release_time_cannot_use_ingestion(self):
  for published in (None, '2026-10-14'):
   with self.assertRaisesRegex(AssertionError, 'verified publication time'):
    validate_industry_updates(self.report(published))
