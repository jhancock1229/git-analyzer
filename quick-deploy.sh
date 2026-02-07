#!/bin/bash

# Quick Deploy - One command deployment
# Usage: ./quick-deploy.sh

set -e

echo "🚀 Quick Deploy Starting..."

# Look for git-analyzer.tar.gz
TAR_FILE="git-analyzer.tar.gz"

if [ ! -f "$TAR_FILE" ]; then
    echo "❌ File not found: $TAR_FILE"
    echo "Please place git-analyzer.tar.gz in this directory"
    exit 1
fi

echo "📦 Extracting $TAR_FILE..."
tar -xzf "$TAR_FILE" --strip-components=1

echo "📝 Adding to git..."
git add .

echo "💾 Committing..."
git commit -m "Update: $(date '+%Y-%m-%d %H:%M')" || echo "Nothing to commit"

echo "☁️  Pushing to GitHub..."
git push

echo "✅ Done! Vercel will auto-deploy from GitHub"
