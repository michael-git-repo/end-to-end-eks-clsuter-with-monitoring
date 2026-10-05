#!/bin/bash
# Script to install Docker on an EC2 instance and configure permissions

# Remove stale Jenkins repository entries that can break apt updates
sudo rm -f /etc/apt/sources.list.d/jenkins.list
sudo rm -f /usr/share/keyrings/jenkins-keyring.asc

# Update the package list while ignoring any stale repo state
sudo apt-get update -y || true

# Install Docker
sudo apt-get install docker.io -y

# Add the 'ubuntu' user to the docker group when it exists
if id -u ubuntu >/dev/null 2>&1; then
  sudo usermod -aG docker ubuntu
fi

# Add the 'jenkins' user to the docker group only if it exists
if id -u jenkins >/dev/null 2>&1; then
  sudo usermod -aG docker jenkins
fi

# Set correct permissions for the Docker socket to allow docker group members to access it
sudo chmod 660 /var/run/docker.sock
sudo chown root:docker /var/run/docker.sock

# Restart Docker service to apply changes
sudo systemctl restart docker

# Verify installation
docker -version

# Run SonarQube container in detached mode with port mapping
#docker run -d --name sonar -p 9000:9000 sonarqube:lts-community

echo ""
echo "🎉🎉🎉 Docker installed successfully! 🎉🎉🎉"
echo "🚀 Containers are ready to rock!"
echo "😄 Your app is one container away from glory!"
echo "🔥 Time to build, ship, and repeat!"
echo "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif"