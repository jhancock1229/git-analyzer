# Deploy to Vercel - Complete Guide

## 🚀 Quick Deploy (Recommended)

### Step 1: Push to GitHub

```bash
# Initialize git in your react-app folder
cd react-app
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com/
2. Click **"Add New Project"**
3. Click **"Import Git Repository"**
4. Select your GitHub repository
5. Vercel will auto-detect Vite - just click **"Deploy"**

### Step 3: Add GitHub Token (Important!)

1. In your Vercel project dashboard, go to **Settings** → **Environment Variables**
2. Add a new variable:
   - **Name:** `GITHUB_TOKEN`
   - **Value:** `ghp_your_token_here` (from https://github.com/settings/tokens)
   - **Environment:** All (Production, Preview, Development)
3. Click **"Save"**
4. Go to **Deployments** → Click the 3 dots on latest deployment → **"Redeploy"**

## ✅ Done!

Your app will be live at: `https://your-project-name.vercel.app`

---

## 🔧 Alternative: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variable
vercel env add GITHUB_TOKEN

# Redeploy with env variable
vercel --prod
```

---

## 📝 Environment Variables

Add these in Vercel dashboard → Settings → Environment Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `GITHUB_TOKEN` | Your GitHub token | Yes (for 5000 req/hr) |

Without `GITHUB_TOKEN`, the app will work but only get 60 requests/hour.

---

## 🐛 Troubleshooting

**Build fails:**
- Make sure all dependencies are in `package.json`
- Check build logs in Vercel dashboard

**API not working:**
- Check `/api/analyze` endpoint exists
- Verify `GITHUB_TOKEN` is set in environment variables
- Check function logs in Vercel dashboard

**Rate limit errors:**
- Add `GITHUB_TOKEN` environment variable
- Get token from: https://github.com/settings/tokens

---

## 🔄 Updates

To update your deployed app:

```bash
git add .
git commit -m "Update"
git push
```

Vercel will automatically redeploy! 🎉
