# Port Reference

This document lists common application ports used by the scripts in this project.

| Service | Port | Purpose |
| --- | --- | --- |
| SonarQube | 9000 | Code quality and security scanning |
| Jenkins | 8080 | CI/CD automation |
| Grafana | 3000 | Metrics and dashboard visualization |
| Docker | 2375/2376 | Docker daemon access (if enabled) |
| Kubernetes / kube-apiserver | 6443 | Kubernetes API server |
| Terraform | N/A | Infrastructure as code tool; no service port |
| Trivy | N/A | Security scanner CLI |
| AWS CLI | N/A | CLI tool; no service port |

## Notes

- Some services may require firewall or security group updates.
- Port mappings can be customized in the scripts or Docker commands.
- Verify actual ports in your environment before exposing them publicly.
