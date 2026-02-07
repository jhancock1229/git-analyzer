#!/bin/bash

# Git Analyzer Deployment Script
# Usage: ./deploy.sh "Your commit message"

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Git Analyzer Deployment Script${NC}\n"

# Check if commit message provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Commit message required${NC}"
    echo "Usage: ./deploy.sh \"Your commit message\""
    exit 1
fi

COMMIT_MSG="$1"

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}📦 Step 1: Checking for tar file...${NC}"

# Look for git-analyzer.tar.gz
TAR_FILE="git-analyzer.tar.gz"

if [ ! -f "$TAR_FILE" ]; then
    echo -e "${RED}❌ File not found: git-analyzer.tar.gz${NC}"
    echo "Please place git-analyzer.tar.gz in this directory"
    exit 1
fi

echo -e "${GREEN}✅ Found: $TAR_FILE${NC}\n"

echo -e "${YELLOW}📂 Step 2: Backing up existing files (if any)...${NC}"

# Create backup if files exist
if [ -d "api" ] || [ -d "src" ] || [ -f "package.json" ]; then
    BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup key directories/files
    [ -d "api" ] && mv api "$BACKUP_DIR/"
    [ -d "src" ] && mv src "$BACKUP_DIR/"
    [ -f "package.json" ] && mv package.json "$BACKUP_DIR/"
    [ -f "vite.config.js" ] && mv vite.config.js "$BACKUP_DIR/"
    [ -f "index.html" ] && mv index.html "$BACKUP_DIR/"
    [ -f "vercel.json" ] && mv vercel.json "$BACKUP_DIR/"
    
    echo -e "${GREEN}✅ Backup created: $BACKUP_DIR${NC}\n"
else
    echo -e "${GREEN}✅ No existing files to backup${NC}\n"
fi

echo -e "${YELLOW}📦 Step 3: Extracting tar file...${NC}"

# Extract tar file
tar -xzf "$TAR_FILE" --strip-components=1

echo -e "${GREEN}✅ Files extracted successfully${NC}\n"

echo -e "${YELLOW}📝 Step 4: Staging changes for git...${NC}"

# Add all changes
git add .

# Show what's being committed
echo -e "\n${BLUE}Files to be committed:${NC}"
git status --short

echo ""
read -p "Continue with commit? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Deployment cancelled${NC}"
    exit 1
fi

echo -e "\n${YELLOW}💾 Step 5: Committing changes...${NC}"

git commit -m "$COMMIT_MSG"

echo -e "${GREEN}✅ Changes committed${NC}\n"

echo -e "${YELLOW}☁️  Step 6: Pushing to GitHub...${NC}"

git push

echo -e "${GREEN}✅ Pushed to GitHub${NC}\n"

echo -e "${BLUE}🎉 Deployment complete!${NC}"
echo -e "${GREEN}Vercel will automatically deploy from GitHub${NC}"
echo -e "\n${YELLOW}📊 Monitor deployment:${NC}"
echo "   • GitHub: Check your repository"
echo "   • Vercel: Check your dashboard"
echo ""
