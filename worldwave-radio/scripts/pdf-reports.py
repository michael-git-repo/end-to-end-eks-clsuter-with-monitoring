"""Generate printable, white-background scan reports from scanner JSON."""
import json
import os
from collections import Counter
from datetime import datetime, timezone
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']
STYLES = getSampleStyleSheet()
CELL = ParagraphStyle('Cell', fontName='Helvetica', fontSize=8, leading=11, textColor=colors.HexColor('#172033'), splitLongWords=True)
HEAD = ParagraphStyle('Head', parent=CELL, fontName='Helvetica-Bold')
WIDTH = landscape(A4)[0] - 64


def paragraph(value, style=CELL, limit=650):
    text = str(value if value is not None else 'Not available')
    if len(text) > limit:
        text = text[:limit] + '... [see JSON]'
    return Paragraph(escape(text).replace('\n', '<br/>'), style)


def table(rows, widths, severity_column=None):
    data = [[paragraph(cell, HEAD if index == 0 else CELL) for cell in row] for index, row in enumerate(rows)]
    result = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    commands = [('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e9eef5')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
                ('GRID', (0, 0), (-1, -1), .35, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]
    palette = {'CRITICAL': '#fce1e4', 'HIGH': '#ffead6', 'MEDIUM': '#fff5cc', 'LOW': '#e4f3e9'}
    if severity_column is not None:
        for index, row in enumerate(rows[1:], 1):
            commands.append(('BACKGROUND', (severity_column, index), (severity_column, index), colors.HexColor(palette.get(str(row[severity_column]), '#eef2f6'))))
    result.setStyle(TableStyle(commands))
    return result


def load_report(path):
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else None
    except (OSError, ValueError):
        return None


def header(title, env):
    return [Paragraph(title, STYLES['Title']), paragraph('MICHAELWAVE RADIO | SECURITY REPORT', HEAD), Spacer(1, 12),
            table([['Run information', 'Value'], ['Repository', env.get('GITHUB_REPOSITORY', 'Local preview')],
                   ['Branch / commit', env.get('GITHUB_REF_NAME', '-') + ' / ' + env.get('GITHUB_SHA', '-')],
                   ['Image', env.get('IMAGE_NAME', '-')], ['Pipeline result', env.get('PIPELINE_STATUS', 'Not provided')],
                   ['Generated (UTC)', datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')]], [130, WIDTH - 130]), Spacer(1, 16)]


def build_pdf(path, story):
    def page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(colors.white)
        canvas.rect(0, 0, *landscape(A4), fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor('#64748b'))
        canvas.setFont('Helvetica', 8)
        canvas.drawString(32, 18, 'MichaelWave Radio | Long cells abbreviated; original JSON contains full details.')
        canvas.drawRightString(landscape(A4)[0] - 32, 18, f'Page {doc.page}')
        canvas.restoreState()
    SimpleDocTemplate(str(path), pagesize=landscape(A4), leftMargin=32, rightMargin=32, topMargin=30, bottomMargin=36,
                      title=Path(path).stem, author='MichaelWave Radio').build(story, onFirstPage=page, onLaterPages=page)


def trivy_story(data, env):
    story = header('Trivy Scan Table Report', env)
    outcome = env.get('TRIVY_OUTCOME', 'success')
    if outcome != 'success' or not data or data.get('SchemaVersion') != 2 or not isinstance(data.get('Results', []), list):
        story.append(paragraph('REPORT UNAVAILABLE: Trivy did not finish successfully or its report is missing/invalid. This does not mean the image is safe.', HEAD))
        return story, 'Unavailable'
    results = data.get('Results', [])
    if any(not isinstance(r, dict) or not isinstance(r.get('Vulnerabilities') or [], list) or any(not isinstance(v, dict) for v in r.get('Vulnerabilities') or []) for r in results):
        story.append(paragraph('REPORT UNAVAILABLE: malformed Trivy vulnerability results.', HEAD))
        return story, 'Unavailable'
    counts = Counter(v.get('Severity', 'UNKNOWN') for result in results for v in result.get('Vulnerabilities') or [])
    story += [paragraph('Reported severities: ' + env.get('TRIVY_SEVERITIES', 'CRITICAL,HIGH,MEDIUM,LOW,UNKNOWN') + '. Counts describe this scan output only.'), Spacer(1, 8),
              table([SEVERITIES, [counts[s] for s in SEVERITIES]], [WIDTH / 5] * 5), Spacer(1, 16)]
    total = sum(counts.values())
    if not total:
        story.append(paragraph('No vulnerabilities were reported in this completed scan. This is not a guarantee that the image is vulnerability-free.'))
    for result in results:
        vulns = result.get('Vulnerabilities') or []
        if not vulns:
            continue
        story += [paragraph(result.get('Target', 'Unknown target'), STYLES['Heading2'], 220),
                  paragraph(f'Type: {result.get("Type", "unknown")} | Reported vulnerabilities: {len(vulns)}'), Spacer(1, 7)]
        rows = [['Library', 'Vulnerability ID', 'Severity', 'Installed version', 'Fixed version', 'Title']]
        for vuln in sorted(vulns, key=lambda v: SEVERITIES.index(v.get('Severity')) if v.get('Severity') in SEVERITIES else 4):
            rows.append([str(vuln.get('PkgName', '-'))[:160], str(vuln.get('VulnerabilityID', '-'))[:100], vuln.get('Severity', 'UNKNOWN'),
                         str(vuln.get('InstalledVersion', '-'))[:100], str(vuln.get('FixedVersion') or 'Not published')[:100], vuln.get('Title') or vuln.get('Description') or '-'])
        story += [table(rows, [110, 100, 62, 80, 80, WIDTH - 432], 2), Spacer(1, 16)]
    return story, f'{total} reported vulnerabilities'


def sonar_story(data, env):
    story = header('SonarQube Quality Report', env)
    if not data or data.get('reportStatus') != 'available':
        story.append(paragraph('REPORT UNAVAILABLE: ' + str((data or {}).get('message', 'No current-run SonarQube analysis could be verified.')), HEAD))
        return story, 'Unavailable'
    gate = data.get('qualityGate', {})
    status = gate.get('status', 'Not available')
    story += [paragraph('Quality gate: ' + status, STYLES['Heading2']), paragraph('Analysis ID: ' + data.get('analysisId', '-')),
              paragraph('Measures are the project snapshot retrieved after this run; concurrent analyses may change them.'), Spacer(1, 10)]
    labels = {'bugs':'Bugs', 'vulnerabilities':'Vulnerabilities', 'code_smells':'Code smells', 'coverage':'Coverage (%)',
              'duplicated_lines_density':'Duplicated lines (%)', 'ncloc':'Lines of code', 'alert_status':'Project quality gate'}
    values = {m.get('metric'):m.get('value', 'Not available') for m in data.get('component', {}).get('measures', [])}
    story += [table([['Metric', 'Value']] + [[label, values.get(key, 'Not available')] for key, label in labels.items()], [WIDTH * .55, WIDTH * .45]), Spacer(1, 16)]
    conditions = gate.get('conditions', [])
    if conditions:
        story += [paragraph('Quality gate conditions', STYLES['Heading2']), table([['Metric', 'Status', 'Actual value', 'Failure threshold', 'Comparator']] +
                  [[c.get('metricKey', '-'), c.get('status', '-'), c.get('actualValue', 'Not available'), c.get('errorThreshold', '-'), c.get('comparator', '-')] for c in conditions], [WIDTH * .32, WIDTH * .16, WIDTH * .18, WIDTH * .18, WIDTH * .16])]
    return story, 'Quality gate: ' + status


def generate(input_dir='.', output_dir='reports', env=None):
    env = dict(os.environ if env is None else env)
    output = Path(output_dir); output.mkdir(parents=True, exist_ok=True)
    trivy, trivy_status = trivy_story(load_report(Path(input_dir) / 'trivy-report.json'), env)
    sonar, sonar_status = sonar_story(load_report(Path(input_dir) / 'sonarqube-report.json'), env)
    build_pdf(output / 'trivy-report.pdf', trivy)
    build_pdf(output / 'sonarqube-report.pdf', sonar)
    build_pdf(output / 'security-summary.pdf', header('Security Report Summary', env) + [table([['Scanner', 'Result'], ['Trivy', trivy_status], ['SonarQube', sonar_status]], [140, WIDTH - 140])])


if __name__ == '__main__':
    generate()
