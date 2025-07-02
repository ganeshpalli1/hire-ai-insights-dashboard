#!/bin/bash

# Deploy to Docker Hub Script
# Usage: ./deploy-docker.sh [version]

set -e  # Exit on any error

# Configuration
DOCKER_REPO="ganeshpalli779/hire-ai-insights-dashboard"
VERSION=${1:-"latest"}
DATE_TAG=$(date +%Y%m%d-%H%M)

echo "🚀 Starting Docker deployment process..."
echo "📦 Repository: $DOCKER_REPO"
echo "🏷️  Version: $VERSION"
echo "📅 Date tag: $DATE_TAG"

# Check if logged in to Docker Hub
echo "🔐 Checking Docker Hub authentication..."
if ! docker info | grep -q "Username"; then
    echo "❌ Not logged in to Docker Hub. Please run 'docker login' first."
    exit 1
fi

echo "✅ Docker Hub authentication verified"

# Build the image
echo "🔨 Building Docker image..."
docker build -t $DOCKER_REPO:$VERSION .
docker build -t $DOCKER_REPO:$DATE_TAG .

echo "✅ Docker image built successfully"

# List the built images
echo "📋 Built images:"
docker images $DOCKER_REPO

# Push to Docker Hub
echo "📤 Pushing to Docker Hub..."
docker push $DOCKER_REPO:$VERSION
docker push $DOCKER_REPO:$DATE_TAG

echo "✅ Images pushed successfully!"

# Verify the push
echo "🔍 Verifying push..."
docker manifest inspect $DOCKER_REPO:$VERSION > /dev/null && echo "✅ $VERSION tag verified"
docker manifest inspect $DOCKER_REPO:$DATE_TAG > /dev/null && echo "✅ $DATE_TAG tag verified"

echo ""
echo "🎉 Deployment completed successfully!"
echo "📦 Image available at: $DOCKER_REPO:$VERSION"
echo "📦 Dated image: $DOCKER_REPO:$DATE_TAG"
echo ""
echo "🚀 To deploy:"
echo "   docker run -p 8000:8000 $DOCKER_REPO:$VERSION"
echo ""
echo "🔗 Docker Hub: https://hub.docker.com/r/$DOCKER_REPO" 