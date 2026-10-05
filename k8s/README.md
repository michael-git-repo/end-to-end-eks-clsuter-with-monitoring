# Simple EKS deployment

- **deployment.yml**: radio app and persistent visitor-data volume.
- **service.yml**: public AWS Network Load Balancer, port 80 to the app's port 8080.
- **argocd.yml**: Argo CD watches the first two files on main and deploys them to the existing EKS cluster.

The pipeline updates the image directly in k8s/deployment.yml. Run the pipeline successfully before applying Argo CD: the initial image values are placeholders.

The Service assumes AWS Load Balancer Controller is installed. For EKS Auto Mode, change loadBalancerClass to eks.amazonaws.com/nlb. Public subnet discovery and controller IAM permissions must be configured. AWS charges apply when the Service provisions the load balancer. Port 80 serves HTTP; HTTPS requires a certificate and TLS listener configuration.

The single replica uses a persistent 1 GiB volume for visitor counts. A default StorageClass and working storage driver are required. Recreate updates briefly interrupt service while keeping the database safe.

Apply only the Argo CD application after the files are pushed and the image is published:

    kubectl --context YOUR_EKS_CONTEXT apply -f k8s/argocd.yml

Then get the public address:

    kubectl --context YOUR_EKS_CONTEXT -n worldwave-radio get service worldwave-radio

Argo CD must already be installed in this EKS cluster, and its default project must allow this repository and namespace. Private GitHub repositories need Argo CD read access; private Docker Hub images need an image pull secret on the Deployment.

Existing external Prometheus/Grafana configuration remains in worldwave-radio/monitoring. Its optional access.yml is applied separately after the namespace exists.

References: [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/latest/guide/service/nlb/), [EKS Auto Mode](https://docs.aws.amazon.com/eks/latest/userguide/auto-configure-nlb.html).
