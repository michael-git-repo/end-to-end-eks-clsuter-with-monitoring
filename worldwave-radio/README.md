# MichaelWave Radio

Website branding: **MichaelWave Radio**, owned by **Michael**, with the tagline **A world of sound.** The project directory and deployment identifiers remain `worldwave-radio` so existing Docker and EKS commands continue to work.

Global internet-radio listening app with Nigeria, Africa, the Americas, Europe, Asia and Oceania browsing. Country and state filters use the public directory. City search matches names, location text and tags; the source has no reliable city field. This covers listed internet streams, not all terrestrial FM transmitters.

## Run locally

Requires Node.js 24 LTS. From this directory:

```sh
npm ci
npm run check
npm test
npm run build
npm start
```

Open http://localhost:8080. The app uses a bundled real Radio Browser catalogue and resolves the latest stream address when you press Listen. Refresh directory retrieves current entries in the browser; this refresh is local to that page. `npm run directory` refreshes the bundled catalogue before building. Station records are untrusted and rendered as text. Playback requires a working HTTPS stream supported by the browser; HTTP-only, geographically restricted, offline and unsupported HLS streams show a website fallback. HLS is supported only where the browser supports it natively.

To build and test using plain Docker, run from this directory:

```sh
docker build -t worldwave-radio:local .
docker run -d --name worldwave-radio-test --mount type=volume,source=michaelwave-radio-data,target=/app/data --init --read-only --cap-drop ALL --security-opt no-new-privileges:true -p 127.0.0.1:8081:8080 worldwave-radio:local
docker ps --filter name=worldwave-radio-test
```

Open http://localhost:8081. The container uses `worldwave-radio:local` and maps your computer's port **8081** to the container's port **8080**, bound to localhost for testing. It runs as a non-root user with a read-only filesystem. This leaves a Node preview on port 8080 available. The container checks `/healthz` automatically.

```sh
docker logs --tail 50 worldwave-radio-test
docker stop worldwave-radio-test
docker start worldwave-radio-test
```

After changing the app, rebuild the image, then replace the old test container:

```sh
docker build -t worldwave-radio:local .
docker stop worldwave-radio-test
docker rm worldwave-radio-test
docker run -d --name worldwave-radio-test --mount type=volume,source=michaelwave-radio-data,target=/app/data --init --read-only --cap-drop ALL --security-opt no-new-privileges:true -p 127.0.0.1:8081:8080 worldwave-radio:local
```

Starting an existing container reuses its original image; replacing it uses the newly built image. No Docker Compose file is needed. EKS deployment continues to use the Kubernetes manifests under `../k8s/`.

## Edo State and Benin City stations

The **Edo State** and **Benin City** shortcuts show 22 researched listings (19 in Benin City, plus Okada Wonderland FM, Hillside FM in Auchi and EBS Ihievbe). `public/edo-stations.json` records each station's source links, city, FM frequency where known, and stream-check result. These additions are merged into both the built directory and browser refresh results; duplicate HOD Radio entries are consolidated and Edo state names normalized.

The catalogue includes Super FM, Speed FM, EBS, KU FM, Vibes FM, B-Side FM, Independent Radio, Rhythm FM, Bronze FM, RayPower Benin, UNIBEN FM, Izibili FM and local internet stations. Research was reviewed on 3 October 2026. Twelve URLs returned audio during endpoint checks; Independent Radio and DivinevibezRadio failed the checks, and eight FM listings have no confirmed direct online stream. A successful endpoint check is not an audible browser playback test or a guarantee of ongoing availability. Known failed or insecure URLs have a disabled **Unavailable** button; entries without URLs link to station information. Stations with usable stream URLs are listed first. No stream from another city or network is substituted for a missing local feed.

Independent Radio's official [ITV radio page](https://www.itvradiong.com/i-radio/) embeds [this Zeno station](https://zeno.fm/radio/independentradiobenin/). Its `61udqk39d4duv` feed and Radio Garden's station link both redirected to the same server, which returned HTTP 503 with “Mount point not active, try again later” on 3 October 2026. The broadcaster must reconnect this feed or publish a replacement. No working replacement was verified. Browser testing was unavailable because no browser was connected.

**Check again** probes configured Edo station streams through the Node server and restores Listen when a stream sends audio. Results are cached for 30 seconds, checks time out after 10 seconds, and redirect hosts are restricted. A network failure is reported as inconclusive rather than marking the broadcaster offline. This feature requires `npm start` or the Docker deployment; a static file preview cannot serve the check endpoint.

Station cards and the player display HTTPS logos from Radio Browser, with 14 downloaded Edo station logos and source attribution in `public/edo-stations.json`. Every station has a local radio icon as a fallback when its logo is absent or fails to load. Remote logos load lazily without a referrer. Refreshing the directory preserves the curated Edo logos.

The player now starts audio directly from the listener's click, without waiting for a directory request that can lose browser playback permission. Radio Browser URL updates run in the background for the next attempt. Pause/resume, blocked playback retries, error messages and rapid station changes have regression tests with a simulated audio element; those tests do not replace an audible browser check.

Primary sources include [EBS](https://ebsng.com/station/ebs-fm-95-7/), [Vibes FM Benin](https://vibesfm.com.ng/), [Super FM Benin](https://superfm.online/station/?id=superfm881), [KU FM](https://kufmtv.net/), [B-Side FM](https://bsidefm.com/), and the [University of Benin repository](https://repository.uniben.edu/impact-university-radio-station-campus-community-development-case-study-uniben-1001fm-station). Secondary directory links are retained per station. Station lists and frequencies can change; this is a researched catalogue, not an exhaustive licensing register. No station location is inferred from the word “Benin” alone.

## Deployment and pipeline

Use the three plain YAML files in [k8s](../k8s/README.md): deployment.yml, service.yml and argocd.yml. The older base/overlay folders and separate Argo CD project have been removed.

The workflow at ../.github/workflows/worldwave-radio.yml installs Node.js 24, runs app tests, scans with SonarQube, builds the Docker image, and scans it with Trivy. On main, the Gmail notification attaches `trivy-report.json`, `sonarqube-report.json`, and SonarQube analysis-task metadata. SonarQube's report file contains project measures when its API is available and otherwise contains a dashboard link. The workflow publishes both `versionN` and commit-SHA image tags to Docker Hub; the first run uses `version1`, the next `version2`, and so on. It then updates `k8s/deployment.yml` for Argo CD. Configure the GitHub secrets `DOCKER_PASSWORD`, `SONAR_TOKEN`, `SONAR_HOST_URL`, `GMAIL_USERNAME`, and `GMAIL_APP_PASSWORD`. The Docker Hub image repository is `bleosas/devsecops-app`.

The current workflow configuration allows test/quality-gate failures to continue and reports Trivy findings without blocking publication. It does not currently run OWASP Dependency-Check. These are the current workflow's settings; review them before production use.

Your existing external Prometheus/Grafana configuration and dashboard are documented in [monitoring setup](monitoring/README.md).

## Validation and limits

The pipeline emails white-background, landscape PDF table reports to **blesosas222@gmail.com**: `trivy-report.pdf`, `sonarqube-report.pdf`, and `security-summary.pdf`. It also keeps the PDFs and original JSON in the `security-pdf-reports` GitHub artifact. Set `GMAIL_USERNAME` and `GMAIL_APP_PASSWORD` in GitHub Secrets for delivery. SonarQube export uses the current scanner task and needs a token with permission to read the project's measures and quality gate. Missing/failed reports are explicitly marked unavailable, never reported as a clean scan. The renderer uses ReportLab 5.0.1; these reports do not require SonarQube's paid PDF reporting feature.

`npm test` checks combined geographic filtering, malicious URL rejection and HTTP security/path handling. `npm run check` checks JavaScript syntax; `npm run build` creates a gzip copy of the directory for delivery. Deployment setup is documented in `../k8s/README.md`. Docker, SonarQube, AWS, SMTP and real browser audio require their respective running services for end-to-end verification. Optional WebMCP search registration is feature-detected; its browser-specific validation is unavailable in this workspace.

The initial Sites registration was superseded by the requested EKS deployment. No Sites deployment is used by this project; ignored `.openai` metadata is not part of the Docker build or CI.

## References

- [Radio Browser API](https://api.radio-browser.info/)
- [Argo CD installation](https://argo-cd.readthedocs.io/en/stable/operator-manual/installation/)
- [EKS load balancing](https://docs.aws.amazon.com/eks/latest/best-practices/load-balancing.html)
- [OWASP Dependency-Check](https://github.com/dependency-check/DependencyCheck)
- [Trivy releases](https://github.com/aquasecurity/trivy/releases)

## Station globe and visitor records

The globe uses D3 geographic projection and locally bundled public-domain Natural Earth country boundaries. It rotates and zooms only after a station starts playing. Published Radio Browser coordinates take priority; Benin City listings can use an explicitly labelled approximate city centre, and other stations fall back to an approximate country location. Missing locations do not get an invented pin. The player?s View map link brings the map into view. Motion off and system reduced-motion preferences jump straight to the location.

Visitor statistics start at zero when this feature is first used. Total visitors estimate distinct browsers using a one-year anonymous HttpOnly cookie; visits count page loads. Daily aggregate records use UTC. No IP addresses, names or email addresses are stored by the counter. The public statistics API exposes totals and the last 30 days of aggregate records, downloadable as CSV; it does not expose visitor identifiers. Health checks and statistics refreshes do not increment visits. These are approximate, not bot-filtered analytics: cleared cookies or different browsers count as new visitors.

SQLite records live in DATA_DIR (default ./data). The plain Docker commands above mount the persistent michaelwave-radio-data volume. Keep that volume when replacing containers to retain visitor history; deleting it deletes that history. The local Node preview and Docker have separate stores.

The EKS manifests now include a 1 GiB ReadWriteOnce claim using the cluster?s default StorageClass and one replica with Recreate deployment strategy. This avoids competing pods during volume attachment, with a brief interruption during deployment. Ensure a suitable default StorageClass and storage driver exist before deployment; the claim is protected from automatic Argo CD pruning/deletion. For multiple replicas, migrate statistics to a shared database before scaling. No changes have been applied to EKS.

Map sources and library licenses ship in /maps/SOURCE.txt and /vendor/. Geographic data: https://www.naturalearthdata.com/about/terms-of-use/; projection documentation: https://d3js.org/d3-geo/.
