import json, os, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'update'))
import miaoxiang_mcp as M

class CredentialsTest(unittest.TestCase):
    def config(self,extra):
        folder=tempfile.TemporaryDirectory();self.addCleanup(folder.cleanup)
        path=Path(folder.name)/'config.toml'
        path.write_text('[mcp_servers.mx-ds-mcp]\nurl="'+M.URL+'"\n'+extra,encoding='utf-8')
        return path
    @patch.dict(os.environ,{},clear=True)
    def test_static_header_and_environment_precedence(self):
        path=self.config('[mcp_servers.mx-ds-mcp.http_headers]\nem_api_key="test-static"\n')
        self.assertEqual(M.configured_key(path),'test-static')
        with patch.dict(os.environ,{'EM_API_KEY':' test-env '}):
            self.assertEqual(M.configured_key(path),'test-env')
    @patch.dict(os.environ,{},clear=True)
    def test_helper_output_stays_in_memory(self):
        path=self.config('http_headers_helper="python helper.py"\n')
        with patch.object(M.subprocess,'run') as run:
            run.return_value.stdout=json.dumps({'em_api_key':'test-helper','other':'ignored'})
            self.assertEqual(M.configured_key(path),'test-helper')
            self.assertEqual(run.call_args.args[0],['python','helper.py'])
            self.assertTrue(run.call_args.kwargs['capture_output'])
            self.assertNotIn('shell',run.call_args.kwargs)
    @patch.dict(os.environ,{},clear=True)
    def test_rejects_wrong_endpoint_before_helper(self):
        path=self.config('http_headers_helper="python helper.py"\n')
        path.write_text(path.read_text().replace(M.URL,'https://example.com'),encoding='utf-8')
        with patch.object(M.subprocess,'run') as run:
            with self.assertRaises(ValueError):M.configured_key(path)
            run.assert_not_called()
    @patch.dict(os.environ,{},clear=True)
    def test_failure_does_not_expose_helper_output(self):
        path=self.config('http_headers_helper="python helper.py"\n')
        with patch.object(M.subprocess,'run',side_effect=RuntimeError('private-output')):
            with self.assertRaisesRegex(ValueError,'^Credential helper failed$') as caught:M.configured_key(path)
            self.assertIsNone(caught.exception.__cause__)
            self.assertTrue(caught.exception.__suppress_context__)
    @patch.dict(os.environ,{},clear=True)
    def test_missing_header_is_empty(self):
        self.assertEqual(M.configured_key(self.config('')),'')

if __name__=='__main__':unittest.main()

