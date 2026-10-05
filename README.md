# DevOps Script Collection

This workspace contains shell scripts for installing and setting up common DevOps tools on Ubuntu-based systems.

## 🎉 Success Mode

When the scripts run successfully, this is the vibe:

✅ Everything is installed and working
😄 The team is happy
🚀 Deployment dreams are now in motion

![Funny success moment](https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif)

## Included scripts

The [Worldwave Radio project](worldwave-radio/README.md) adds a global radio app with a GitHub Actions security pipeline, Docker packaging, Docker Hub publication, report emails, and Argo CD deployment to an existing EKS cluster. Its workflow is in `.github/workflows/worldwave-radio.yml`.

- awscli.sh
- docker.sh
- eksctl.sh
- grafana.sh
- jenkins.sh
- kubectl.sh
- permissionexecute.sh
- sonarqube.sh
- terraform.sh
- trivy.sh

## Usage

Make each script executable before running it:

```bash
chmod +x script-name.sh
./script-name.sh
```

## Notes

- These scripts are intended for Ubuntu/Linux environments.
- Run them with appropriate privileges when required.
- Review each script before execution in production environments.

## 🏆 Success check

If your script finishes without errors, you should see:

- A valid command output
- No installation failure messages
- A working tool version or service running

![Happy developer](https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80)
