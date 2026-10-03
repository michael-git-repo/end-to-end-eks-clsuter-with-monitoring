#!/bin/bash
# Script to install eksctl on an instance

# Download and extract the latest eksctl binary
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp

# Move eksctl to /usr/local/bin to make it executable from anywhere
sudo mv /tmp/eksctl /usr/local/bin

# Verify installation
kubectl version --client

echo ""
echo "🎉🎉🎉 eksctl installed successfully! 🎉🎉🎉"
echo "🚀 EKS clusters are calling your name!"
echo "😄 Kubernetes wizard mode activated!"
echo "🔥 Time to deploy with confidence!"
echo "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif"