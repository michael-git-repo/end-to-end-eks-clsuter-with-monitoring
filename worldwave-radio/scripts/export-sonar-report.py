"""Export current-run SonarQube results without logging credentials."""
import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def export_report(env, metadata, get):
    host = env.get('SONAR_HOST_URL', '').rstrip('/')
    token = env.get('SONAR_TOKEN', '')
    if not host or not token or not metadata.get('ceTaskId'):
        raise ValueError('Current-run scanner metadata or SonarQube configuration is missing.')
    task = get('api/ce/task', {'id': metadata['ceTaskId']}).get('task', {})
    if task.get('status') != 'SUCCESS' or not task.get('analysisId'):
        raise ValueError('Current-run SonarQube analysis is not complete; no older analysis is substituted.')
    project = metadata.get('projectKey', 'worldwave-radio')
    metrics = 'alert_status,bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,ncloc'
    measures = get('api/measures/component', {'component': project, 'metricKeys': metrics})
    gate = get('api/qualitygates/project_status', {'analysisId': task['analysisId']})
    return {**measures, 'reportStatus': 'available', 'analysisId': task['analysisId'], 'qualityGate': gate.get('projectStatus', {})}


def main():
    host = os.environ.get('SONAR_HOST_URL', '').rstrip('/')
    def get(path, params):
        request = Request(host + '/' + path + '?' + urlencode(params), headers={'Authorization': 'Bearer ' + os.environ['SONAR_TOKEN']})
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    try:
        metadata = dict(line.split('=', 1) for line in Path('worldwave-radio/.scannerwork/report-task.txt').read_text().splitlines() if '=' in line)
        report = export_report(os.environ, metadata, get)
    except Exception:
        report = {'reportStatus': 'unavailable', 'message': 'Current-run analysis or report API data is unavailable. Check scanner results, token Browse permission, and SonarQube connectivity.'}
    Path('sonarqube-report.json').write_text(json.dumps(report), encoding='utf-8')


if __name__ == '__main__':
    main()
