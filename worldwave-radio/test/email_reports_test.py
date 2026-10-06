import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch
import zipfile

spec = importlib.util.spec_from_file_location('email_reports', Path(__file__).parents[1] / 'scripts' / 'email-reports.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class EmailReportTest(unittest.TestCase):
    def test_missing_settings_and_insecure_ports_never_connect(self):
        for env, error in [({}, RuntimeError), ({'SMTP_HOST': 'smtp.example', 'SMTP_PORT': '25',
                'SMTP_USERNAME': 'test', 'SMTP_PASSWORD': 'test', 'SMTP_FROM': 'ci@example.com'}, ValueError)]:
            with patch.dict(module.os.environ, env, clear=True), patch.object(module.smtplib, 'SMTP') as connect, \
                 patch.object(module.smtplib, 'SMTP_SSL') as connect_ssl:
                with self.assertRaises(error):
                    module.main()
                connect.assert_not_called()
                connect_ssl.assert_not_called()

    def test_authentication_and_delivery_require_tls(self):
        with tempfile.TemporaryDirectory() as folder:
            for port in ['465', '587']:
                env = {'SMTP_HOST': 'smtp.example', 'SMTP_PORT': port, 'SMTP_USERNAME': 'test-user',
                       'SMTP_PASSWORD': 'test-password', 'SMTP_FROM': 'ci@example.com', 'REPORT_DIR': folder}
                client = MagicMock()
                with patch.dict(module.os.environ, env, clear=True), \
                     patch.object(module.smtplib, 'SMTP', return_value=client) as plain, \
                     patch.object(module.smtplib, 'SMTP_SSL', return_value=client) as secure:
                    module.main()
                if port == '465':
                    secure.assert_called_once()
                    plain.assert_not_called()
                    self.assertIn('context', secure.call_args.kwargs)
                    client.starttls.assert_not_called()
                else:
                    plain.assert_called_once()
                    secure.assert_not_called()
                    self.assertEqual([call[0] for call in client.method_calls],
                                     ['ehlo', 'starttls', 'ehlo', 'login', 'send_message'])
                client.login.assert_called_once_with('test-user', 'test-password')
                client.send_message.assert_called_once()

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
