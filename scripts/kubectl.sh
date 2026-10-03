#!/bin/bash
# Script to install kubectl on an instance

# Update package list
sudo apt update -y

# Install curl
sudo apt install curl -y

# Download the latest stable kubectl binary
curl -LO https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl

# Install kubectl and set correct permissions
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Verify the installation
kubectl version --client

echo ""
echo "🎉🎉🎉 kubectl installed successfully! 🎉🎉🎉"
echo "🚀 Cluster commands are ready to go!"
echo "😄 Kubernetes control is in your hands!"
echo "🔥 Time to tame the cluster!"
echo "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif"