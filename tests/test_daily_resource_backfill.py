import copy, sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from backfill_daily_resources import reconcile
from build_daily_resource_list import allowed_attachment


class ResourceBackfillTests(unittest.TestCase):
    def snapshots(self):
        old = {'date': '2026-10-15', 'windowStart': '2026-10-14T16:00:00+08:00',
               'cutoff': '2026-10-15T16:00:00+08:00', 'sourceThrough': 'frozen research coverage',
               'groups': {'segments': [{'url': 'https://example.com/frozen'}], 'minutes': [], 'audio': [], 'reports': []},
               'attachmentCatalog': {'generatedAt': '2026-10-14T17:11:00+08:00'}}
        fresh = copy.deepcopy(old)
        fresh['groups']['segments'] = [{'url': 'https://example.com/late-text'}]
        fresh['groups']['audio'] = [{'title': '古茗调研一线反馈20261014.mp3'}]
        fresh['attachmentCatalog'] = {'generatedAt': '2026-10-16T16:37:30+08:00', 'scan': {
            'observedAt': '2026-10-16T16:37:30+08:00', 'windowStart': '2026-10-14T00:00:00+08:00',
            'windowEnd': '2026-10-16T16:37:30+08:00', 'windowComplete': True,
            'boundaryReachedBeforeWindow': True, 'topicPages': 23}}
        return old, fresh

    def test_late_index_backfills_attachments_without_rewriting_research_or_window(self):
        old, fresh = self.snapshots(); original = copy.deepcopy(old)
        out = reconcile(old, fresh, '2026-10-16T20:15:00+08:00')
        self.assertEqual(old, original)
        self.assertEqual(out['groups']['segments'], old['groups']['segments'])
        self.assertEqual(out['sourceThrough'], old['sourceThrough'])
        self.assertEqual(out['cutoff'], old['cutoff'])
        self.assertEqual(out['groups']['audio'], fresh['groups']['audio'])
        self.assertEqual(reconcile(out, fresh, 'later'), out)

    def test_incomplete_new_index_cannot_erase_valid_attachments(self):
        old, fresh = self.snapshots(); old['groups']['audio'] = [{'title': 'valid.mp3'}]
        fresh['attachmentCatalog']['scan']['windowEnd'] = '2026-10-15T09:00:00+08:00'
        with self.assertRaises(AssertionError): reconcile(old, fresh, 'now')
        self.assertEqual(old['groups']['audio'], [{'title': 'valid.mp3'}])

    def test_empty_sector_matches_company_but_incidental_retail_software_is_excluded(self):
        self.assertTrue(allowed_attachment({'name': '古茗20261014.pdf', 'sectors': []}))
        self.assertFalse(allowed_attachment({'name': 'LendAPI：为零售商提供品牌嵌入式金融.mp3', 'sectors': ['retail']}))
