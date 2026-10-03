#!/bin/bash
# Script to install and run SonarQube using Docker

# Update package list
sudo apt-get update -y

# Install Docker if not already installed
sudo apt-get install docker.io -y

# Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Add the current user to the docker group
sudo usermod -aG docker $USER

# Create Docker volumes for SonarQube persistence
sudo docker volume create sonarqube_data
sudo docker volume create sonarqube_logs
sudo docker volume create sonarqube_extensions

# Run SonarQube container
sudo docker run -d --name sonarqube \
  -p 9000:9000 \
  -v sonarqube_data:/opt/sonarqube/data \
  -v sonarqube_logs:/opt/sonarqube/logs \
  -v sonarqube_extensions:/opt/sonarqube/extensions \
  sonarqube:lts-community

# Check running containers
sudo docker ps --filter name=sonarqube

# Print access URL
echo "SonarQube is running on http://localhost:9000"
echo "Default login: admin / admin"

echo ""
echo "🎉🎉🎉 SonarQube installed successfully! 🎉🎉🎉"
echo "🚀 Code quality checks are now ON!"
echo "😄 Clean code energy activated!"
echo "🔥 Security and quality just leveled up!"
echo "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif"