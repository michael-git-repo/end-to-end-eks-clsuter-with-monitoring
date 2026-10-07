#!/bin/bash

set -e

echo "================================="
echo "Installing Argo CD"
echo "================================="

# Create namespace
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

# Install Argo CD
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo ""
echo "Waiting for Argo CD server..."

kubectl wait \
  --for=condition=Available \
  deployment/argocd-server \
  -n argocd \
  --timeout=300s

echo ""
echo "Creating AWS LoadBalancer..."

kubectl patch svc argocd-server \
  -n argocd \
  -p '{"spec":{"type":"LoadBalancer"}}'

echo ""
echo "Waiting for AWS LoadBalancer..."

for i in {1..30}; do
    ARGO_HOST=$(kubectl get svc argocd-server \
      -n argocd \
      -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

    if [ -n "$ARGO_HOST" ]; then
        break
    fi

    echo "Waiting for LoadBalancer..."
    sleep 10
done

echo ""
echo "================================="
echo "Argo CD Pods"
echo "================================="

kubectl get pods -n argocd

echo ""
echo "================================="
echo "Argo CD Service and Ports"
echo "================================="

kubectl get svc argocd-server -n argocd

echo ""
echo "================================="
echo "LOGIN DETAILS"
echo "================================="

echo "Username: admin"

echo -n "Password: "
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

echo ""
echo ""

echo "================================="
echo "ACCESS ARGO CD"
echo "================================="

echo "HTTPS Port: 443"
echo "HTTP Port: 80"

if [ -n "$ARGO_HOST" ]; then
    echo ""
    echo "Argo CD address:"
    echo "https://$ARGO_HOST"
else
    echo ""
    echo "LoadBalancer is still being created."
    echo "Run:"
    echo "kubectl get svc argocd-server -n argocd"
fi

echo ""
echo "================================="
echo "Installation complete"
echo "================================="
