import importlib.util
import json
import tempfile
import unittest
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
