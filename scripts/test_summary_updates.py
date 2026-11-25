import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from summary_io import write_json_if_changed
from build_site_summaries import run, ROOT
from build_resource_index import build as resource_index
from build_home_snapshot import build as home


class SummaryUpdateTests(unittest.TestCase):
    def test_timestamp_only_changes_keep_bytes_and_mtime(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'summary.json'
            write_json_if_changed(path, {'generatedAt': 'old', 'items': [{'value': 1}]})
            before, modified = path.read_bytes(), path.stat().st_mtime_ns
            self.assertFalse(write_json_if_changed(path, {'generatedAt': 'new', 'items': [{'value': 1}]}, {'generatedAt'}))
            self.assertEqual((path.read_bytes(), path.stat().st_mtime_ns), (before, modified))
            self.assertTrue(write_json_if_changed(path, {'generatedAt': 'new', 'items': [{'value': 2}]}, {'generatedAt'}))
            path.write_text('broken', encoding='utf-8')
            self.assertTrue(write_json_if_changed(path, {'items': []}))

    def fixture(self, directory):
        root = Path(directory)
        (root/'data/industry').mkdir(parents=True)
        (root/'data/research').mkdir(parents=True)
        (root/'scripts').mkdir()
        datasets = [{'id': key, 'file': 'data/'+key+'.csv'} for key in
                    ('views','all_views','minutes','hotel_industry_weekly','dutyfree_monthly','gold','dining','valuation')]
        (root/'data-manifest.json').write_text(json.dumps({'datasets': datasets}), encoding='utf-8')
        for d in datasets: (root/d['file']).write_text('initial', encoding='utf-8')
        (root/'data/research/library.json').write_text('{}', encoding='utf-8')
        (root/'data/coverage-companies.json').write_text('{"companies": []}', encoding='utf-8')
        def execute(command, **kwargs):
            script = Path(command[1]).name
            if script == 'build_research_recent.py':
                output, content = 'data/research/recent.json', (root/'data/views.csv').read_text()
            elif script == 'build_industry_snapshot.py':
                output, content = 'data/industry/overview.json', (root/'data/gold.csv').read_text()
            elif script == 'build_home_snapshot.py':
                output, content = 'data/home-snapshot.json', (root/'data/research/recent.json').read_text() + (root/'data/industry/overview.json').read_text()
            else:
                output, content = 'data/research/resource-index.json', (root/'data/research/library.json').read_text() + (root/'data/home-snapshot.json').read_text()
            (root/output).write_text(content, encoding='utf-8')
        return root, execute

    def test_incremental_dependencies_missing_outputs_and_day_rollover(self):
        with tempfile.TemporaryDirectory() as directory:
            root, execute = self.fixture(directory)
            with patch('build_site_summaries.subprocess.run', side_effect=execute) as call:
                day = dt.date(2026, 10, 9)
                run(root, as_of=day)
                call.reset_mock()
                repeat = run(root, as_of=day)
                self.assertEqual({r['status'] for r in repeat.values()}, {'skipped'})
                call.assert_not_called()
                (root/'data/research/library.json').write_text('{"new":true}', encoding='utf-8')
                changed = run(root, as_of=day)
                self.assertEqual([k for k,v in changed.items() if v['status'] != 'skipped'], ['resources'])
                (root/'data/coverage-companies.json').write_text('{"companies": [{"code":"600754.SH"}]}', encoding='utf-8')
                changed_pool = run(root, as_of=day)
                self.assertEqual([k for k,v in changed_pool.items() if v['status'] != 'skipped'], ['resources'])
                call.reset_mock()
                (root/'data/research/resource-index.json').unlink()
                run(root, as_of=day)
                self.assertEqual(call.call_count, 1)
                call.reset_mock()
                run(root, as_of=day + dt.timedelta(days=1))
                self.assertEqual(call.call_count, 1)  # Research window still advances daily.
                (root/'data/gold.csv').write_text('updated', encoding='utf-8')
                call.reset_mock()
                run(root, as_of=day + dt.timedelta(days=1))
                self.assertEqual(call.call_count, 3)  # industry -> home -> resources

    def test_home_reuses_overview_without_reading_legacy_csvs(self):
        with patch('build_home_snapshot.rows', side_effect=AssertionError('Legacy CSV reread')):
            result = home(ROOT, dt.datetime(2026,10,9,tzinfo=dt.timezone(dt.timedelta(hours=8))))
        self.assertEqual(len(result['industries']), 4)

    def test_title_directory_preserves_originals_and_excludes_private_and_text_fields(self):
        result = resource_index(ROOT)
        minutes = [r for r in result['items'] if r['kind'] == 'minutes']
        self.assertTrue(any(r['title'] == '20260930 华住集团交流纪要.docx' for r in minutes))
        library = json.loads((ROOT/'data/research/library.json').read_text(encoding='utf-8'))
        original = {r['id']: r for r in library['records']}
        for row in minutes:
            self.assertEqual(row['title'], original[row['id']]['name'])
            if original[row['id']].get('dateStatus') == 'needs_review': self.assertEqual(row['date'], '')
        public = json.dumps(result)
        for field in ('contentPath', 'cloudVersion', 'driveId', 'itemId', 'openUrl', 'sha256', 'summary', 'preview'):
            self.assertNotIn('"'+field+'"', public)


if __name__ == '__main__': unittest.main()
