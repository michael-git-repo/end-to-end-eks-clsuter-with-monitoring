#!/usr/bin/env bash
set -euo pipefail
: "${KUBE_CONTEXT:?Set KUBE_CONTEXT to your existing EKS context}"
: "${TOKEN_FILE:?Set TOKEN_FILE to the file read by Prometheus}"
# Run as the account that owns TOKEN_FILE and can request this service account token.
# Never print the token; use a temporary file and an atomic replacement.
umask 077
temporary=$(mktemp "${TOKEN_FILE}.XXXXXX")
trap 'rm -f -- "$temporary"' EXIT
kubectl --context "$KUBE_CONTEXT" -n worldwave-radio create token worldwave-monitor --duration=2h > "$temporary"
test -s "$temporary"
mv -f -- "$temporary" "$TOKEN_FILE"
echo 'Refreshed the MichaelWave monitoring token.'
