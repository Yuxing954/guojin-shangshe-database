import json, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from validate_daily_editorial import validate_announcement_monitoring


class MonitoringTests(unittest.TestCase):
    def test_no_check_cannot_be_hidden_behind_empty_announcement_array(self):
        with self.assertRaises(AssertionError):
            validate_announcement_monitoring({'announcementMonitoringRequired': True, 'companyAnnouncements': []})

    def test_partial_failures_are_explicit_and_cannot_claim_complete(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'data').mkdir()
            (root/'data/coverage-companies.json').write_text(json.dumps({'companies':[{'code':'A'},{'code':'B'}]}))
            d={'announcementMonitoringRequired':True,'windowStart':'2026-10-15T16:00:00+08:00','cutoff':'2026-10-16T16:00:00+08:00'}
            d['announcementMonitoring']={'checkedAt':'2026-10-16T16:10:00+08:00','windowStart':d['windowStart'],'cutoff':d['cutoff'],
                'coverageFile':'data/coverage-companies.json','evidenceFile':'data/daily/evidence/test.json','status':'partial',
                'checkedCompanies':[{'code':'A','sources':['https://example.com'],'status':'source_failed'}],
                'excludedCompanies':[{'code':'B','reason':'outside daily scope'}], 'failedCompanies':[{'code':'A'}]}
            with patch('validate_daily_editorial.ROOT',root):
                validate_announcement_monitoring(d)
                d['announcementMonitoring']['status']='complete'
                with self.assertRaises(AssertionError):validate_announcement_monitoring(d)
