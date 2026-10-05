# Monitor MichaelWave from your existing Prometheus and Grafana machine

These files reuse your existing monitoring installation. Nothing here installs another Prometheus or Grafana, changes EKS infrastructure, or replaces your existing cluster monitoring jobs.

## 1. Deploy the app through GitHub Actions and Argo CD

The app exposes `GET /metrics` on port 8080. Apply the optional monitoring/access.yml separately after the app namespace exists. It creates a dedicated `worldwave-monitor` ServiceAccount and a namespaced Role allowing GET requests through the API proxy for only `worldwave-radio:http`. This permission covers GET paths on that service, not just `/metrics`; it grants no access to other services, pods, secrets or cluster administration. From the repository root: `kubectl --context "$KUBE_CONTEXT" apply -f worldwave-radio/monitoring/access.yml`.

The app now has a public LoadBalancer Service. This monitoring configuration still uses the authenticated EKS API proxy. Your monitoring machine must be able to reach the existing EKS API endpoint on HTTPS. For a private endpoint, use its existing VPC/VPN/network route. No public metrics load balancer is required. This API-proxy scrape targets the current **single replica**; use per-pod discovery if you later migrate the visitor database and scale the app.

## 2. Supply cluster credentials on the monitoring machine

Use your existing AWS/kubectl authentication and explicit EKS context. Retrieve the endpoint and certificate using your existing cluster name and region:

```sh
aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" --query cluster.endpoint --output text
aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" --query cluster.certificateAuthority.data --output text | base64 --decode > eks-ca.crt
```

Place the certificate at `/etc/prometheus/worldwave/eks-ca.crt`. Create that directory using your server's normal permissions, readable by the Prometheus service account. The endpoint hostname, without `https://`, replaces `REPLACE_EKS_API_HOST` in `prometheus.example.yml`.

Generate a short-lived token without printing it:

```sh
export KUBE_CONTEXT=YOUR_EXISTING_EKS_CONTEXT
export TOKEN_FILE=/etc/prometheus/worldwave/token
bash scripts/refresh-monitoring-token.sh
```

Run the script as the account that owns and reads the token file. That account needs an existing authenticated kubeconfig with permission to request a token for this ServiceAccount; the scrape token itself has no token-renewal permission. Keep these credentials on the monitoring machine, never in GitHub variables, source control or this repository. Tokens expire: integrate this script with your existing credential rotation, for example every 20 minutes for its requested two-hour token. The API server can grant a shorter duration; verify your cluster policy and schedule renewal before expiry. Monitor renewal failures. The script writes mode-0600 files atomically. If Prometheus runs in Docker, mount the **directory** read-only so atomic replacements remain visible; match the file owner's UID to the Prometheus process.

## 3. Merge the Prometheus configuration

Copy `alerts.yml` to `/etc/prometheus/rules/michaelwave-radio.yml`. Merge the one `scrape_configs` entry and the `rule_files` entry from `prometheus.example.yml` into your existing configuration. Preserve your current jobs, global settings and Alertmanager configuration. Replace the EKS hostname and adjust certificate/token paths to paths visible inside the Prometheus process/container.

Validate the merged file before using your normal reload mechanism:

```sh
promtool check config /etc/prometheus/prometheus.yml
promtool check rules /etc/prometheus/rules/michaelwave-radio.yml
```

After reload, find `michaelwave-radio` on Prometheus's Targets page. It should be UP. A 401 commonly indicates an expired token, 403 an RBAC mismatch, and a timeout a network/API endpoint access problem. Test the proxy using your existing authenticated kubectl context:

```sh
kubectl --context "$KUBE_CONTEXT" get --raw '/api/v1/namespaces/worldwave-radio/services/worldwave-radio:http/proxy/metrics'
```

This command uses your workstation identity; Prometheus uses the separate limited ServiceAccount token. Keep TLS certificate validation enabled.

## 4. Import the Grafana dashboard

In your existing Grafana, use **Dashboards > New > Import**, upload `grafana-dashboard.json`, and select your existing Prometheus data source from the dashboard's **Prometheus** selector. It shows reachability, request rate, server errors, response time, CPU, memory and uptime. Rate charts need at least two scrapes; some panels remain empty until the app receives traffic.

The alert file covers failed/missing scrapes, sustained HTTP 5xx errors and memory approaching the current 256 MiB limit. Alerts use your existing Alertmanager routing; these files do not configure or send alert emails. The GitHub workflow separately emails Trivy/OWASP reports to the configured report recipient.

Application request metrics exclude health probes and metrics scrapes. Labels contain only a small set of route categories, HTTP methods and status codes, never query strings, station IDs, IPs or visitor cookies. These metrics reset with each Node process. Radio audio flows directly from broadcasters to browsers, so these charts **do not measure active listeners or broadcaster stream uptime**. Your existing EKS monitoring continues to supply node and cluster metrics.

References: [Kubernetes service proxy](https://kubernetes.io/docs/tasks/access-application-cluster/access-cluster-services/), [Prometheus scrape configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/), [Prometheus text format](https://prometheus.io/docs/instrumenting/exposition_formats/).
