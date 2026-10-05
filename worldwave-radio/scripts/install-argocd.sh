#!/usr/bin/env bash
set -euo pipefail
: "${KUBE_CONTEXT:?Set KUBE_CONTEXT to the intended existing EKS context}"
# Deliberately refuse to overwrite an existing Argo CD installation.
if kubectl --context "$KUBE_CONTEXT" -n argocd get deployment argocd-server >/dev/null 2>&1; then
  echo 'Argo CD already exists. Reuse it and apply only the Worldwave project/application.'
  exit 0
fi
kubectl --context "$KUBE_CONTEXT" create namespace argocd --dry-run=client -o yaml | kubectl --context "$KUBE_CONTEXT" apply -f -
kubectl --context "$KUBE_CONTEXT" apply --server-side -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/v3.5.3/manifests/install.yaml
kubectl --context "$KUBE_CONTEXT" -n argocd rollout status deployment/argocd-server --timeout=300s
