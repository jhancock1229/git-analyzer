# Deployment Guide

This app supports **both** Vercel (serverless) and k3s (self-hosted) deployments.

## Option 1: Deploy to Vercel (Easiest)

Perfect for quick setup with no infrastructure management.

### Steps:

1. **Push to GitHub:**
   ```bash
   git push
   ```

2. **Import to Vercel:**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository

3. **Add Environment Variable:**
   - Settings → Environment Variables
   - Name: `GH_TOKEN`
   - Value: your GitHub token
   - Check: Production

4. **Redeploy:**
   - Deployments tab → Redeploy latest

**Pros:**
- Zero server management
- Auto-scaling
- Global CDN
- Free SSL
- Automatic deployments on git push

**Cons:**
- 10 second function timeout (free tier)
- Costs money for high traffic
- Less control

---

## Option 2: Deploy to k3s (Self-Hosted)

Perfect for full control, no timeouts, and running on your own infrastructure.

### Prerequisites:
- k3s cluster running
- Docker registry access
- Domain pointed to cluster

### Quick Start:

```bash
# 1. Create secret
kubectl create secret generic git-analyzer-secrets \
  --from-literal=gh-token='ghp_your_token_here'

# 2. Build image
docker build -t your-registry/git-analyzer:latest .
docker push your-registry/git-analyzer:latest

# 3. Update k8s/deployment.yaml with your registry and domain

# 4. Deploy
kubectl apply -f k8s/deployment.yaml

# 5. Check status
kubectl get pods -l app=git-analyzer
```

**Pros:**
- No timeout limits
- Full control
- No per-request costs
- Can scale as needed
- Private infrastructure

**Cons:**
- Must manage infrastructure
- Need to set up ingress/SSL
- Manual scaling

See [K3S-DEPLOY.md](./K3S-DEPLOY.md) for detailed k3s instructions.

---

## Running Both Simultaneously

You can run both! They share the same codebase:

```bash
# Vercel for public access
https://git-analyzer.vercel.app

# k3s for internal/heavy use
https://git-analyzer.internal.yourdomain.com
```

**When to use which:**
- **Vercel**: Public demo, light usage, quick access
- **k3s**: Internal team, heavy analysis, large repos

---

## Local Development

Same for both deployment targets:

```bash
# Install
npm install

# Create .env
echo "GH_TOKEN=your_token" > .env

# Run dev server
npm run dev
```

Frontend: http://localhost:5173
API: Handled by Vite proxy

---

## Testing Before Deployment

### Test with Docker locally:

```bash
# Build
docker build -t git-analyzer:test .

# Run
docker run -p 3000:3000 -e GH_TOKEN=your_token git-analyzer:test

# Test
curl http://localhost:3000/api/health
open http://localhost:3000
```

### Test with docker-compose:

```bash
# Set token
export GH_TOKEN=your_token

# Start
docker-compose up

# Test
open http://localhost:3000
```

---

## Switching Between Deployments

The app automatically detects its environment:

**Vercel:**
- Uses serverless functions in `/api` directory
- Functions run independently
- Environment: Vercel serverless

**k3s/Docker:**
- Runs Express server (api/server.js)
- Serves static files + API from one process
- Environment: Node.js production

No code changes needed - same codebase works for both!

---

## Environment Variables

Both platforms need:
- `GH_TOKEN` or `GITHUB_TOKEN` - Your GitHub personal access token

**Vercel:** Set in project settings
**k3s:** Set in k8s/secret.yaml

---

## Updating Deployments

### Vercel:
```bash
git push  # Auto-deploys
```

### k3s:
```bash
./deploy-k3s.sh  # Builds, pushes, deploys
```

---

## Monitoring

### Vercel:
- Dashboard → Your Project → Logs
- Real-time function logs
- Performance analytics

### k3s:
```bash
# Logs
kubectl logs -f deployment/git-analyzer

# Status
kubectl get pods
kubectl describe pod <pod-name>

# Metrics (if monitoring installed)
kubectl top pods
```

---

## Cost Comparison

### Vercel Free Tier:
- ✅ 100GB bandwidth
- ✅ Unlimited requests
- ✅ 10s function timeout
- ❌ Need Pro for longer timeouts ($20/mo)

### k3s Self-Hosted:
- ✅ No per-request costs
- ✅ No timeout limits
- ✅ Unlimited bandwidth
- ❌ Infrastructure costs (server/cluster)
- ❌ Time investment (setup/maintenance)

**Recommendation:**
- Start with Vercel for simplicity
- Move to k3s if you hit timeouts or want more control
- Run both for redundancy
