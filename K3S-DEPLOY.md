# Deploying Git Analyzer to k3s

## Prerequisites

- k3s cluster running
- kubectl configured to access your cluster
- Docker registry (Docker Hub, Harbor, or private registry)
- Domain name pointing to your k3s cluster

## Initial Setup

### 1. Create GitHub Token Secret

```bash
# Replace with your actual token
kubectl create secret generic git-analyzer-secrets \
  --from-literal=gh-token='ghp_your_token_here'
```

Or use the YAML file:
```bash
# Edit k8s/secret.yaml with your token
kubectl apply -f k8s/secret.yaml
```

### 2. Update Configuration

Edit `k8s/deployment.yaml`:
- Replace `your-registry/git-analyzer:latest` with your registry path
- Replace `git-analyzer.yourdomain.com` with your domain

Edit `deploy-k3s.sh`:
- Set `REGISTRY` to your Docker registry

### 3. Build and Push Image

```bash
# Build locally
docker build -t your-registry/git-analyzer:latest .

# Push to registry
docker push your-registry/git-analyzer:latest
```

### 4. Deploy to k3s

```bash
# Apply deployment
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -l app=git-analyzer
kubectl get svc git-analyzer-service
kubectl get ingress git-analyzer-ingress
```

### 5. Verify Deployment

```bash
# Check pods are running
kubectl get pods

# Check logs
kubectl logs -l app=git-analyzer --tail=50

# Test health endpoint
kubectl port-forward svc/git-analyzer-service 8080:80
curl http://localhost:8080/api/health
```

## Using the Deployment Script

After initial setup:

```bash
./deploy-k3s.sh
```

This will:
1. Build new Docker image
2. Tag with git commit hash
3. Push to registry
4. Update k8s deployment
5. Wait for rollout to complete

## Updating the App

```bash
# Update code
git pull

# Rebuild and deploy
./deploy-k3s.sh
```

## Scaling

```bash
# Scale to 3 replicas
kubectl scale deployment git-analyzer --replicas=3

# Auto-scale based on CPU
kubectl autoscale deployment git-analyzer \
  --cpu-percent=70 \
  --min=2 \
  --max=10
```

## Monitoring

```bash
# Watch pods
kubectl get pods -w

# View logs
kubectl logs -f deployment/git-analyzer

# Describe pod (for debugging)
kubectl describe pod <pod-name>
```

## Troubleshooting

### Pods not starting

```bash
# Check pod events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Common issues:
# - Image pull errors: Check registry credentials
# - Secret not found: Ensure git-analyzer-secrets exists
# - Port conflicts: Check if ports are already in use
```

### 504 Timeout Errors

Increase timeout in ingress:
```yaml
annotations:
  nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
```

### Out of Memory

Increase resource limits:
```yaml
resources:
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

## Alternative: Using Local Docker Registry

If you don't have an external registry:

```bash
# Run local registry
docker run -d -p 5000:5000 --restart=always --name registry registry:2

# Build and tag
docker build -t localhost:5000/git-analyzer:latest .

# Push to local registry
docker push localhost:5000/git-analyzer:latest

# Update deployment.yaml to use localhost:5000/git-analyzer:latest
```

## Clean Up

```bash
# Delete deployment
kubectl delete -f k8s/deployment.yaml

# Delete secret
kubectl delete secret git-analyzer-secrets
```
