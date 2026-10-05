"""Send scanner files over authenticated SMTP with mandatory TLS; no credentials in logs."""
import os
import ssl
import smtplib
import io
import zipfile
from pathlib import Path
from email.message import EmailMessage

def make_message(env, report_dir):
    message = EmailMessage()
    message['From'] = env['SMTP_FROM']
    message['To'] = env.get('REPORT_EMAIL', 'blesosas222@gmail.com')
    message['Subject'] = f"Worldwave Radio — security reports ({env.get('SCAN_RESULT', 'unknown')})"
    files = sorted(p for p in Path(report_dir).rglob('*') if p.is_file() and not p.is_symlink())
    message.set_content(f"Security scan result: {env.get('SCAN_RESULT', 'unknown')}\nRun: {env.get('RUN_URL', '')}\n\nTrivy JSON/text reports and OWASP reports are attached when produced.\nMissing reports mean that scan did not complete; they do not mean a clean scan.\n")
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
        for file in files:
            output.write(file, file.relative_to(report_dir))
        if not files:
            output.writestr('scan-incomplete.txt', 'No scan reports were produced. Inspect the GitHub Actions run.')
    if archive.tell() > 18 * 1024 * 1024:
        raise RuntimeError('Report archive exceeds 18 MB; use the GitHub Actions artifacts.')
    message.add_attachment(archive.getvalue(), maintype='application', subtype='zip', filename='worldwave-security-reports.zip')
    return message

def main():
    required = ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM')
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise RuntimeError('Configure GitHub SMTP settings: ' + ', '.join(missing))
    port = int(os.environ['SMTP_PORT'])
    if port not in (465, 587):
        raise ValueError('Use SMTP port 465 (TLS) or 587 (STARTTLS).')
    context = ssl.create_default_context()
    message = make_message(os.environ, os.environ.get('REPORT_DIR', 'reports'))
    host = os.environ['SMTP_HOST']
    client = smtplib.SMTP_SSL(host, port, context=context, timeout=30) if port == 465 else smtplib.SMTP(host, port, timeout=30)
    with client:
        if port == 587:
            client.ehlo()
            client.starttls(context=context)
            client.ehlo()
        client.login(os.environ['SMTP_USERNAME'], os.environ['SMTP_PASSWORD'])
        client.send_message(message)
    print('Security report email sent.')

if __name__ == '__main__':
    main()
