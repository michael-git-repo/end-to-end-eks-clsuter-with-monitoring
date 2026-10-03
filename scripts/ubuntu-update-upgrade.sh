#!/bin/bash
# Ubuntu system update and upgrade script

# Update package lists
sudo apt-get update -y

# Upgrade installed packages
sudo apt-get upgrade -y

# Perform full system upgrade
sudo apt-get full-upgrade -y

# Clean up unnecessary packages
sudo apt-get autoremove -y
sudo apt-get autoclean -y

echo ""
echo "🎉🎉🎉 Ubuntu update and upgrade completed successfully! 🎉🎉🎉"
echo "🚀 Your system is fresh, updated, and ready to go!"
echo "😄 Keep it secure and keep shipping!"
echo "🔥 DevOps energy activated!"