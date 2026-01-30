# Git Repository Analyzer - Deployment Guide

## Current Status
✅ Simplified to core functionality: **Activity Summary**
✅ Code is syntax-valid and ready to deploy

## What's Included
- Activity Summary with code change analysis
- Top Contributors list
- Dark mode support
- Time range selection

## Deployment Steps

### Option 1: Vercel (Recommended)
```bash
cd git-analyzer
tar -xzf ../react-app.tar.gz --strip-components=1
git add .
git commit -m "Deploy simplified summary-focused version"
git push
```

Vercel will automatically:
1. Run `npm install`
2. Run `npm run build`  
3. Deploy to production

### Option 2: Local Testing
```bash
cd git-analyzer
npm install
npm run build
npm run preview
```

## Troubleshooting Build Errors

If Vercel shows "npm run build exited with 1":

1. **Check Vercel logs** - Click on the deployment to see detailed error
2. **Common causes**:
   - Node version mismatch (we use Node 18+)
   - Missing environment variables
   - Network timeout during npm install

3. **Fix**: Add `.nvmrc` file:
```bash
echo "18" > .nvmrc
git add .nvmrc
git commit -m "Set Node version"
git push
```

## API Endpoint
The API is serverless and runs at `/api/analyze`

### Request:
```json
{
  "repoUrl": "https://github.com/owner/repo",
  "timeRange": "week"
}
```

### Response:
```json
{
  "success": true,
  "data": {
    "totalCommits": 247,
    "timeRange": "Last Week",
    "primaryBranch": "main",
    "contributors": [...],
    "activitySummary": "Very active: 15 developers pushed 247 commits..."
  }
}
```

## File Structure
```
git-analyzer/
├── api/
│   └── analyze.js          # Serverless API endpoint
├── src/
│   ├── App.jsx             # Main UI (simplified)
│   ├── App.css             # Styles
│   └── main.jsx            # Entry point
├── package.json
├── vercel.json
└── vite.config.js
```

## Current Limitations
- Analyzes up to 10 branches (prevents timeout)
- Fetches 15 most recent commits for code analysis
- 10-second Vercel timeout (serverless limit)

## Next Steps
If you need more features, they should be added incrementally after confirming this base version works.
