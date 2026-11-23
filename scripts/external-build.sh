#!/bin/bash
set -e

# Resolve repository root directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Check for DOCKER_PAT environment variable
if [ -z "$DOCKER_PAT" ]; then
    echo "Error: DOCKER_PAT environment variable is not set. Please set it before running this script." >&2
    exit 1
fi

DOCKER_USER="${DOCKER_USER:-xconnected}"
ECR_LOC="${ECR_LOC:-xconnected}"
ECR_REPO="${ECR_REPO:-components}"
VERSION="${VERSION:-0.1}"
BUILDER_NAME="${BUILDER_NAME:-tender-tracker-builder}"

# 1. Build frontend dist into backend/public
echo "[INFO] Building frontend dist into backend/public..."
cd "$REPO_ROOT/frontend"
npm install --silent
VITE_OUT_DIR="../backend/public" npm run build
# Fallback copy if Vite output went to build/
if [ -d "$REPO_ROOT/frontend/build" ]; then
    mkdir -p "$REPO_ROOT/backend/public"
    cp -r "$REPO_ROOT/frontend/build/"* "$REPO_ROOT/backend/public/"
fi
cd "$REPO_ROOT"

if [ ! -d "$REPO_ROOT/backend/public" ]; then
    echo "[ERROR] backend/public was not created. Frontend build failed!" >&2
    exit 1
fi
echo "[SUCCESS] Frontend build ready in backend/public."

# Service definitions: Single Unified Full-Stack Backend
services=(
    "tender-tracker-backend . backend/Dockerfile"
)

# 2. Login to Registry first (required before running buildx with --push)
echo "[INFO] Logging in to registry ($ECR_LOC)..."
echo "$DOCKER_PAT" | docker login -u "$DOCKER_USER" --password-stdin

# 3. Setup Docker Buildx builder for multi-arch builds
echo "[INFO] Setting up Docker Buildx builder ($BUILDER_NAME)..."
docker buildx create --use --name "$BUILDER_NAME" 2>/dev/null || docker buildx use "$BUILDER_NAME"

# 4. Build, tag, and push service using buildx
for service_info in "${services[@]}"; do
    read -r name context dockerfile <<< "$service_info"
    remote_tag="${ECR_LOC}/${ECR_REPO}:${name}-${VERSION}"
    
    echo "[INFO] Building and pushing multi-platform image for ${name} (${remote_tag})..."
    docker buildx build --platform linux/amd64,linux/arm64 "$context" -f "$dockerfile" -t "$remote_tag" --push
done

echo "[SUCCESS] Multi-platform backend with embedded frontend built and pushed successfully!"
