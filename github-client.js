const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function githubRequest(url, params = {}) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Git-Repo-Analyzer'
  };
  
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }
  
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  
  const response = await fetch(fullUrl, { headers });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `GitHub API error: ${response.status}`);
  }
  
  return response.json();
}

function parseGitHubUrl(repoUrl) {
  const match = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL. Must be: https://github.com/owner/repo');
  }
  return { owner: match[1], repo: match[2] };
}

module.exports = {
  githubRequest,
  parseGitHubUrl,
  GITHUB_API_BASE
};