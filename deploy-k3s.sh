#!/bin/bash

set -e

echo "🚀 Deploying Git Analyzer to k3s"

# Configuration
REGISTRY="your-registry.example.com"
IMAGE_NAME="git-analyzer"
TAG="$(git rev-parse --short HEAD)"

# Build Docker image
echo "📦 Building Docker image..."
docker build -t ${REGISTRY}/${IMAGE_NAME}:${TAG} .
docker tag ${REGISTRY}/${IMAGE_NAME}:${TAG} ${REGISTRY}/${IMAGE_NAME}:latest

# Push to registry
echo "⬆️  Pushing to registry..."
docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}
docker push ${REGISTRY}/${IMAGE_NAME}:latest

# Update k8s deployment
echo "🔄 Updating Kubernetes deployment..."
kubectl set image deployment/git-analyzer git-analyzer=${REGISTRY}/${IMAGE_NAME}:${TAG}

# Wait for rollout
echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/git-analyzer

echo "✅ Deployment complete!"
echo "🌐 App available at: https://git-analyzer.yourdomain.com"
