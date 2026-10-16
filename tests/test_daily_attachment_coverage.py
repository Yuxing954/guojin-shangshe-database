import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_daily_report import stamp
from daily_attachment_coverage import attachment_catalog, validate_attachment_coverage
from validate_daily_editorial import validate


class AttachmentCoverageTests(unittest.TestCase):
    def test_blocked_draft_cannot_be_published(self):
        with self.assertRaisesRegex(AssertionError, 'unresolved publication blockers'):
            validate({'publicationStatus': 'blocked'})

    def fixture(self):
        return {'windowStart': '2026-10-15T16:00:00+08:00', 'cutoff': '2026-10-16T16:00:00+08:00',
                'attachmentCatalog': {'sourceThrough': '2026-10-16T15:42:00+08:00', 'scan': {
                    'windowStart': '2026-10-15T16:00:00+08:00', 'windowEnd': '2026-10-16T16:00:00+08:00',
                    'observedAt': '2026-10-16T16:02:00+08:00', 'windowComplete': True,
                    'boundaryReachedBeforeWindow': True, 'topicPages': 8}}}

    def test_latest_topic_need_not_equal_cutoff(self):
        validate_attachment_coverage(self.fixture())

    def test_research_coverage_does_not_fill_attachment_gap(self):
        d = self.fixture(); d['sourceThrough'] = '2026-10-16T16:02:00+08:00'
        d['attachmentCatalog']['scan']['windowEnd'] = '2026-10-16T09:28:28+08:00'
        with self.assertRaisesRegex(AssertionError, 'Attachment scan'):
            validate_attachment_coverage(d)

    def test_missing_boundary_or_receipt_cannot_confirm_empty_list(self):
        for key in ('boundaryReachedBeforeWindow', 'windowComplete', 'topicPages', 'observedAt'):
            d = self.fixture(); del d['attachmentCatalog']['scan'][key]
            with self.assertRaises(AssertionError): validate_attachment_coverage(d)

    def test_scan_after_cutoff_cannot_compensate_for_missing_start(self):
        d = self.fixture(); d['attachmentCatalog']['scan']['windowStart'] = '2026-10-16T00:00:00+08:00'
        with self.assertRaises(AssertionError): validate_attachment_coverage(d)
