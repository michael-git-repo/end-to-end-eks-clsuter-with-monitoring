#!/usr/bin/env bash
set -euo pipefail
: "${AWS_REGION:?Set AWS_REGION to your existing cluster region}"
: "${EKS_CLUSTER_NAME:?Set EKS_CLUSTER_NAME to your existing cluster name}"
aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" --query 'cluster.{name:name,status:status,version:version}'
aws eks update-kubeconfig --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" --alias "worldwave-$EKS_CLUSTER_NAME"
kubectl --context "worldwave-$EKS_CLUSTER_NAME" get nodes
