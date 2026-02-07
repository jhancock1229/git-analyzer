# Git Repository Analyzer

Visualize GitHub repository activity and contributor statistics.

## Setup

```bash
npm install
```

Add your GitHub token to `.env`:
```
GITHUB_TOKEN=your_token_here
```

Get a token at: https://github.com/settings/tokens (needs `public_repo` scope)

## Development

```bash
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variable:
   - Name: `GITHUB_TOKEN`
   - Value: your token
   - **Important**: Select "Production" (or all environments)
4. **Redeploy** after adding the token (go to Deployments → click ⋯ → Redeploy)

## Troubleshooting

**"GitHub token not configured" error on Vercel:**
1. Verify token is in Settings → Environment Variables
2. Make sure it's set for "Production" environment
3. **You must redeploy** after adding environment variables
4. Check the token has `public_repo` or `repo` scope

**Token working locally but not on Vercel:**
- Environment variables added after initial deploy require a manual redeploy
- Go to Deployments tab → Find latest deployment → Click ⋯ menu → Redeploy


