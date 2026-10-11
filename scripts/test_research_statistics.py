"""Update metadata must describe the actual deduplicated batches."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from build_research_recent import refresh_update_statistics

class StatisticsTest(unittest.TestCase):
    def test_refresh_preserves_provenance_and_is_repeatable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'data/research/updates/manifest.json'
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps({'sourceGroup': 'source', 'syncedAt': 'original', 'counts': {'views': 1}, 'files': {}, 'assignedTopics': {'views': ['123']}}), encoding='utf-8')
            rows = {'views': [{'时间': '2026-10-11T20:00:00'}, {'时间': '2026-10-10'}], 'all_views': [], 'minutes': [{'日期': '2026-09-28'}]}
            with patch('build_research_recent.update_rows', side_effect=lambda _root, kind: rows[kind]):
                refresh_update_statistics(root)
                result = json.loads(path.read_text(encoding='utf-8'))
                before = path.read_bytes()
                refresh_update_statistics(root)
                self.assertEqual(before, path.read_bytes())
            self.assertEqual(result['counts'], {'views': 2, 'all_views': 0, 'minutes': 1})
            self.assertEqual(result['latest']['views'], '2026-10-11T20:00:00')
            self.assertEqual(result['sourceGroup'], 'source')
            self.assertEqual(result['syncedAt'], 'original')
            self.assertEqual(result['assignedTopics'], {'views': ['123']})

if __name__ == '__main__':
    unittest.main()
