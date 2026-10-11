import copy
import csv
import json
import tempfile
import unittest
from pathlib import Path
from validate_research_data import run


class ResearchValidationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.updates = self.root / 'data/research/updates'
        self.updates.mkdir(parents=True)
        self.manifest = self.updates / 'manifest.json'
        self.briefs = self.root / 'data/research/market-briefs.json'
        self.meta = {'files': {}, 'counts': {}, 'latest': {},
                     'coverageTo': 'source timestamp stays unchanged',
                     'lastRun': {'runId': 'audit-unchanged'},
                     'assignedTopics': {'views': ['123'], 'all_views': ['456']}}
        for kind, topic in [('views', '123'), ('all_views', '456'), ('minutes', '789')]:
            path = self.updates / (kind + '.csv')
            with path.open('w', encoding='utf-8-sig', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=['时间', '标题', '内容', '原文链接'])
                writer.writeheader()
                writer.writerow({'时间': '2026-10-11T21:00:00', '标题': kind,
                                 '内容': kind, '原文链接': 'https://wx.zsxq.com/group/1/topic/' + topic})
            self.meta['files'][kind] = [path.relative_to(self.root).as_posix()]
            self.meta['counts'][kind] = 0
            self.meta['latest'][kind] = '2026-10-11T08:00:00'
        self.data = {'briefs': [{'id': 'brief', 'conclusion': 'Keep authored prose',
                                 'sources': [{'topicId': '123', 'publishedAt': 'original time'}],
                                 'evidence': [{'source': '123', 'text': 'Original evidence'}]}]}
        self.save()

    def save(self):
        self.manifest.write_text(json.dumps(self.meta), encoding='utf-8')
        self.briefs.write_text(json.dumps(self.data), encoding='utf-8')

    def test_check_fails_without_mutation_and_repair_is_idempotent(self):
        before = (self.manifest.read_bytes(), self.briefs.read_bytes())
        with self.assertRaisesRegex(ValueError, 'Stale research'):
            run(self.root)
        self.assertEqual(before, (self.manifest.read_bytes(), self.briefs.read_bytes()))
        self.assertEqual(len(run(self.root, repair=True)), 2)
        meta = json.loads(self.manifest.read_text())
        expected = copy.deepcopy(self.meta)
        expected['counts'] = dict.fromkeys(('views', 'all_views', 'minutes'), 1)
        expected['latest'] = dict.fromkeys(('views', 'all_views', 'minutes'), '2026-10-11T21:00:00')
        self.assertEqual(meta, expected)
        data = json.loads(self.briefs.read_text())
        expected_briefs = copy.deepcopy(self.data)
        expected_briefs['briefs'][0]['sources'][0]['kind'] = 'views'
        self.assertEqual(data, expected_briefs)
        after = (self.manifest.read_bytes(), self.briefs.read_bytes())
        self.assertEqual(run(self.root, repair=True), [])
        self.assertEqual(after, (self.manifest.read_bytes(), self.briefs.read_bytes()))
        self.assertEqual(run(self.root), [])

    def test_invalid_sources_and_evidence_never_write(self):
        for field, value in [('topicId', 'missing'), ('kind', 'all_views')]:
            with self.subTest(field=field):
                original = copy.deepcopy(self.data)
                self.data['briefs'][0]['sources'][0][field] = value
                self.save()
                before = (self.manifest.read_bytes(), self.briefs.read_bytes())
                with self.assertRaises(ValueError): run(self.root, repair=True)
                self.assertEqual(before, (self.manifest.read_bytes(), self.briefs.read_bytes()))
                self.data = original
        self.data['briefs'][0]['evidence'][0]['source'] = 'missing'
        self.save()
        with self.assertRaisesRegex(ValueError, 'undeclared'): run(self.root, repair=True)

    def test_ambiguous_source_is_not_guessed(self):
        self.meta['files']['all_views'] = self.meta['files']['views']
        self.save()
        with self.assertRaisesRegex(ValueError, 'cannot resolve'): run(self.root, repair=True)

    def test_overlap_assignment_is_rejected(self):
        self.meta['assignedTopics']['all_views'].append('123')
        self.save()
        with self.assertRaisesRegex(ValueError, 'both views'): run(self.root, repair=True)

    def test_empty_stream_and_duplicate_batches(self):
        self.meta['files']['views'] *= 2
        self.meta['files']['minutes'] = []
        self.save()
        run(self.root, repair=True)
        meta = json.loads(self.manifest.read_text())
        self.assertEqual(meta['counts']['views'], 1)
        self.assertEqual(meta['counts']['minutes'], 0)
        self.assertEqual(meta['latest']['minutes'], '')

    def test_summary_workflow_persists_repaired_manifest(self):
        workflow = (Path(__file__).resolve().parents[1] /
                    '.github/workflows/build-research-recent.yml').read_text()
        stage = next(line for line in workflow.splitlines() if 'git add ' in line)
        self.assertIn('data/research/updates/manifest.json', stage.split())
        self.assertIn('data/research/market-briefs.json', stage.split())
        self.assertLess(workflow.index('validate_research_data.py --repair'),
                        workflow.index('python scripts/build_site_summaries.py'))
        self.assertLess(workflow.index('python scripts/test_research_updates.py'),
                        workflow.index('git commit'))
        self.assertIn('python scripts/test_research_statistics.py', workflow)


if __name__ == '__main__': unittest.main()
