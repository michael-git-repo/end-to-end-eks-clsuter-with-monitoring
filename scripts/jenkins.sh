#!/bin/bash
#this Script belong to Cloudaseem Youtube channel #####
# jenkins installation on ubuntu 
sudo apt update -y
sudo apt install fontconfig openjdk-17-jre -y
sudo wget -O /usr/share/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt-get update -y
sudo apt-get install jenkins -y 
sudo systemctl enable jenkins
sudo systemctl start jenkins

echo ""
echo "🎉🎉🎉 Jenkins installed successfully! 🎉🎉🎉"
echo "🚀 CI/CD pipeline power unlocked!"
echo "😄 Your automation dreams are live!"
echo "🔥 Build, test, deploy, repeat!"
echo "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif"