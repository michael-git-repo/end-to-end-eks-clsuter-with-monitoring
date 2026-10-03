#!/bin/bash
# Script to install AWS CLI on an instance

# Download the AWS CLI installer
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

# Install unzip package if not already installed
sudo apt-get install unzip -y

# Unzip the AWS CLI installer
unzip awscliv2.zip

# Run the AWS CLI installation script
sudo ./aws/install

# Verify installation
aws --version

echo ""
echo "🎉🎉🎉 AWS CLI installed successfully! 🎉🎉🎉"
echo "🚀 Deployment ready! The cloud is now your playground!"
echo "😄 Great job, DevOps hero!"
echo "🔥 Keep shipping awesome infrastructure!"
echo "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif"