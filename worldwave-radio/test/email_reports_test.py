import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('email_reports', Path(__file__).parents[1] / 'scripts' / 'email-reports.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class EmailReportTest(unittest.TestCase):
    def test_attaches_report_files_without_sending(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'trivy-image.json').write_text('{"Results": []}')
            message = module.make_message({'SMTP_FROM': 'ci@example.com', 'SCAN_RESULT': 'failure'}, directory)
            self.assertEqual(message['To'], 'blesosas222@gmail.com')
            attachment = list(message.iter_attachments())[0]
            with zipfile.ZipFile(io.BytesIO(attachment.get_payload(decode=True))) as archive:
                self.assertEqual(archive.namelist(), ['trivy-image.json'])

    def test_missing_report_is_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            message = module.make_message({'SMTP_FROM': 'ci@example.com'}, directory)
            attachment = list(message.iter_attachments())[0]
            with zipfile.ZipFile(io.BytesIO(attachment.get_payload(decode=True))) as archive:
                self.assertIn('scan-incomplete.txt', archive.namelist())
