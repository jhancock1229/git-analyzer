const express = require('express');
const cors = require('cors');
const { parseGitHubUrl } = require('./github-client');
const { analyzeGitHubRepo } = require('./repo-analyzer');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

app.post('/api/analyze', async (req, res) => {
  try {
    const { repoUrl, timeRange } = req.body;
    console.log(`📥 Request: ${repoUrl} (${timeRange})`);
    
    const { owner, repo } = parseGitHubUrl(repoUrl);
    const data = await analyzeGitHubRepo(owner, repo, timeRange);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      hint: 'Make sure the URL is a public GitHub repository. For private repos, set GITHUB_TOKEN environment variable.'
    });
  }
});

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 GitHub API-based Git Analyzer                         ║
║  📡 Running on http://localhost:${PORT}                      ║
║                                                           ║
║  ✨ No git cloning required!                              ║
║  💾 No storage costs                                       ║
║  ⚡ Much faster analysis                                   ║
║  📊 Rate limit: ${GITHUB_TOKEN ? '5,000' : '60'} requests/hour ${!GITHUB_TOKEN ? '(unauthenticated)' : ''}         ║
║                                                           ║
║  💡 Set GITHUB_TOKEN env variable to increase rate limit  ║
╚═══════════════════════════════════════════════════════════╝
`);
});