import importlib.util
import json
import io
from base64 import b64decode
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse
from pathlib import Path


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parents[1] / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pdf = load('pdf_reports', 'pdf-reports.py')
sonar = load('export_sonar', 'export-sonar-report.py')


class PDFReportsTest(unittest.TestCase):
    def test_missing_failed_and_malformed_reports_are_not_clean_scans(self):
        for data in [None, {}, {'message': 'failed'}, {'SchemaVersion': 2, 'Results': 'bad'}]:
            self.assertEqual(pdf.trivy_story(data, {})[1], 'Unavailable')
        self.assertEqual(pdf.trivy_story({'SchemaVersion': 2, 'Results': []}, {'TRIVY_OUTCOME': 'failure'})[1], 'Unavailable')
        self.assertEqual(pdf.trivy_story({'SchemaVersion': 2, 'Results': []}, {})[1], '0 reported vulnerabilities')

    def test_wrapped_multi_page_tables_and_missing_reports_generate_pdfs(self):
        with tempfile.TemporaryDirectory() as folder:
            data = {'SchemaVersion': 2, 'Results': [{'Target': 'sample <target> & packages', 'Vulnerabilities': [
                {'PkgName': 'long-package-' * 12, 'Severity': 'HIGH', 'VulnerabilityID': f'SAMPLE-{i}', 'InstalledVersion': '1.0',
                 'Title': 'Sample title <xml> & text ' * 30} for i in range(75)]}]}
            Path(folder, 'trivy-report.json').write_text(json.dumps(data))
            pdf.generate(folder, folder, {'GITHUB_REPOSITORY': 'example/<untrusted>&repo'})
            for name in ['trivy-report.pdf', 'sonarqube-report.pdf', 'security-summary.pdf']:
                self.assertTrue(Path(folder, name).read_bytes().startswith(b'%PDF-'))

    def test_current_analysis_is_required_for_sonar_export(self):
        env = {'SONAR_HOST_URL': 'https://sonar.example', 'SONAR_TOKEN': 'test-not-a-real-token'}
        calls = []
        def get(path, params):
            calls.append((path, params))
            return {'task': {'status': 'PENDING'}}
        with self.assertRaises(ValueError):
            sonar.export_report(env, {'ceTaskId': 'current-task'}, get)
        self.assertEqual(len(calls), 1)
        def success(path, params):
            if path == 'api/ce/task':
                return {'task': {'status': 'SUCCESS', 'analysisId': 'current-analysis'}}
            if path == 'api/qualitygates/project_status':
                self.assertEqual(params, {'analysisId': 'current-analysis'})
                return {'projectStatus': {'status': 'ERROR'}}
            return {'component': {'measures': [{'metric': 'bugs', 'value': '3'}]}}
        report = sonar.export_report(env, {'ceTaskId': 'current-task'}, success)
        self.assertEqual(report['reportStatus'], 'available')
        self.assertEqual(pdf.sonar_story(report, {})[1], 'Quality gate: ERROR')

    def test_export_command_uses_current_task_and_authenticated_api(self):
        env = {'SONAR_HOST_URL': 'https://sonar.example/', 'SONAR_TOKEN': 'test-token'}
        def respond(request, timeout):
            scheme, credentials = request.get_header('Authorization').split(' ', 1)
            self.assertEqual(scheme, 'Basic')
            self.assertEqual(b64decode(credentials).decode(), 'test-token:')
            self.assertEqual(timeout, 30)
            url = urlparse(request.full_url)
            if url.path == '/api/ce/task':
                self.assertEqual(parse_qs(url.query), {'id': ['current-task']})
                result = {'task': {'status': 'SUCCESS', 'analysisId': 'analysis-123'}}
            elif url.path == '/api/qualitygates/project_status':
                self.assertEqual(parse_qs(url.query), {'analysisId': ['analysis-123']})
                result = {'projectStatus': {'status': 'ERROR', 'conditions': [
                    {'metricKey': 'new_coverage', 'status': 'ERROR', 'actualValue': '0', 'errorThreshold': '80', 'comparator': 'LT'}]}}
            else:
                self.assertEqual(url.path, '/api/measures/component')
                result = {'component': {'measures': [{'metric': 'coverage', 'value': '45'}]}}
            return io.BytesIO(json.dumps(result).encode())
        with patch.dict(sonar.os.environ, env, clear=True), patch.object(sonar, 'urlopen', side_effect=respond), \
             patch.object(Path, 'read_text', return_value='ceTaskId=current-task\nprojectKey=worldwave-radio\n'), \
             patch.object(Path, 'write_text') as write:
            sonar.main()
        report = json.loads(write.call_args.args[0])
        self.assertEqual(report['analysisId'], 'analysis-123')
        story, status = pdf.sonar_story(report, {})
        self.assertEqual(status, 'Quality gate: ERROR')
        with tempfile.TemporaryDirectory() as folder:
            pdf.build_pdf(Path(folder, 'gate.pdf'), story)
            self.assertTrue(Path(folder, 'gate.pdf').read_bytes().startswith(b'%PDF-'))

    def test_export_failure_never_leaks_credentials_or_uses_old_results(self):
        with patch.dict(sonar.os.environ, {}, clear=True), \
             patch.object(Path, 'read_text', side_effect=OSError('private details')), \
             patch.object(Path, 'write_text') as write, patch.object(sonar, 'urlopen') as request:
            sonar.main()
        report = json.loads(write.call_args.args[0])
        self.assertEqual(report['reportStatus'], 'unavailable')
        self.assertNotIn('private details', report['message'])
        request.assert_not_called()
        with self.assertRaises(ValueError):
            sonar.export_report({}, {}, request)

    def test_invalid_nested_findings_and_invalid_json_are_unavailable(self):
        for results in [[None], [{'Vulnerabilities': 'invalid'}], [{'Vulnerabilities': [None]}]]:
            self.assertEqual(pdf.trivy_story({'SchemaVersion': 2, 'Results': results}, {})[1], 'Unavailable')
        with tempfile.TemporaryDirectory() as folder:
            report = Path(folder, 'scan.json')
            for contents in ['[1, 2]', '{invalid']:
                report.write_text(contents)
                self.assertIsNone(pdf.load_report(report))
        self.assertEqual(pdf.trivy_story({'SchemaVersion': 2, 'Results': [{'Vulnerabilities': []}]}, {})[1], '0 reported vulnerabilities')
