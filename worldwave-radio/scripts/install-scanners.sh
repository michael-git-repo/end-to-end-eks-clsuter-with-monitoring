#!/usr/bin/env bash
set -euo pipefail
# GitHub-hosted Ubuntu x86_64. Java is installed separately by setup-java (Temurin).
[[ "$(uname -m)" == x86_64 ]] || { echo 'This installer requires x86_64.' >&2; exit 1; }
java -version
tools_dir="${RUNNER_TEMP:-/tmp}/worldwave-tools"
mkdir -p "$tools_dir/bin"
curl --fail --location --retry 3 https://github.com/aquasecurity/trivy/releases/download/v0.75.0/trivy_0.75.0_Linux-64bit.tar.gz -o "$tools_dir/trivy.tar.gz"
printf '%s  %s\n' 'c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f' "$tools_dir/trivy.tar.gz" | sha256sum --check
tar -xzf "$tools_dir/trivy.tar.gz" -C "$tools_dir/bin" trivy
curl --fail --location --retry 3 https://github.com/dependency-check/DependencyCheck/releases/download/v13.0.0/dependency-check-13.0.0-release.zip -o "$tools_dir/dependency-check.zip"
printf '%s  %s\n' '44d920d1ec03e948df862a253f0912782a31b9beee8a7c8895b9cb95760176ed' "$tools_dir/dependency-check.zip" | sha256sum --check
unzip -q -o "$tools_dir/dependency-check.zip" -d "$tools_dir"
chmod +x "$tools_dir/dependency-check/bin/dependency-check.sh"
if [[ -n "${GITHUB_PATH:-}" ]]; then
  printf '%s\n' "$tools_dir/bin" "$tools_dir/dependency-check/bin" >> "$GITHUB_PATH"
fi
"$tools_dir/bin/trivy" --version
"$tools_dir/dependency-check/bin/dependency-check.sh" --version
