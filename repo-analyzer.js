const { githubRequest, GITHUB_API_BASE } = require('./github-client');
const { analyzeBranchingPatterns } = require('./branching-analyzer');

function getTimeRangeDate(timeRange) {
  const now = new Date();
  const ranges = {
    day: 1,
    week: 7,
    month: 30,
    quarter: 90,
    '6months': 180,
    year: 365
  };
  
  if (timeRange === 'all') return null;
  
  const days = ranges[timeRange] || 7;
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function getTimeRangeLabel(timeRange) {
  const labels = {
    day: 'Last 24 Hours',
    week: 'Last Week',
    month: 'Last Month',
    quarter: 'Last Quarter',
    '6months': 'Last 6 Months',
    year: 'Last Year',
    all: 'All Time'
  };
  return labels[timeRange] || 'Last Week';
}

async function analyzeGitHubRepo(owner, repo, timeRange) {
  console.log(`\n📊 Analyzing ${owner}/${repo} via GitHub API...`);
  
  const sinceDate = getTimeRangeDate(timeRange);
  
  // Get repository info
  const repoInfo = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}`);
  const primaryBranch = repoInfo.default_branch;
  
  console.log(`✓ Primary branch: ${primaryBranch}`);
  
  // Get all branches
  const branches = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches`, {
    per_page: 100
  });
  
  console.log(`✓ Found ${branches.length} branches`);
  
  // Get commits
  let allCommits = [];
  let page = 1;
  const maxPages = 5;
  
  while (page <= maxPages) {
    const params = { 
      per_page: 100, 
      page,
      sha: primaryBranch
    };
    if (sinceDate) {
      params.since = sinceDate;
    }
    
    const commits = await githubRequest(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`,
      params
    );
    
    if (commits.length === 0) break;
    
    allCommits = allCommits.concat(commits);
    console.log(`  Page ${page}: ${commits.length} commits (total: ${allCommits.length})`);
    
    if (commits.length < 100) break;
    page++;
  }
  
  console.log(`✓ Total commits: ${allCommits.length}`);
  
  // Get pull requests
  const pullRequests = await githubRequest(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`,
    { state: 'closed', per_page: 100 }
  );
  
  const mergedPRs = pullRequests.filter(pr => pr.merged_at);
  console.log(`✓ Found ${mergedPRs.length} merged PRs`);
  
  // Process data
  const contributors = new Map();
  const graphNodes = [];
  const timelineByDate = new Map();
  
  for (const commit of allCommits) {
    const author = commit.commit.author;
    const email = author.email;
    const name = author.name;
    const timestamp = Math.floor(new Date(author.date).getTime() / 1000);
    const message = commit.commit.message;
    const isMerge = commit.parents && commit.parents.length > 1;
    
    // Track contributors
    if (!contributors.has(email)) {
      contributors.set(email, {
        name: name,
        email: email,
        commits: 0,
        additions: 0,
        deletions: 0,
        branches: [{ name: primaryBranch, isPrimary: true }],
        merges: 0
      });
    }
    const contributor = contributors.get(email);
    contributor.commits++;
    if (isMerge) contributor.merges++;
    
    // Graph node
    graphNodes.push({
      hash: commit.sha.substring(0, 7),
      fullHash: commit.sha,
      author: name,
      email: email,
      timestamp: timestamp,
      subject: message.split('\n')[0].substring(0, 50),
      parents: (commit.parents || []).map(p => p.sha.substring(0, 7)),
      branches: [primaryBranch],
      isMerge: isMerge
    });
    
    // Timeline
    const dateKey = new Date(timestamp * 1000).toISOString().split('T')[0];
    if (!timelineByDate.has(dateKey)) {
      timelineByDate.set(dateKey, {
        date: dateKey,
        commits: 0,
        contributors: new Set()
      });
    }
    const dayData = timelineByDate.get(dateKey);
    dayData.commits++;
    dayData.contributors.add(name);
  }
  
  // Format timeline
  const timeline = Array.from(timelineByDate.values())
    .map(day => ({
      date: day.date,
      commits: day.commits,
      contributors: day.contributors.size
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Detect merges
  const merges = allCommits
    .filter(c => c.parents && c.parents.length > 1)
    .slice(0, 10)
    .map(c => ({
      author: c.commit.author.name,
      branchName: 'merged',
      time: new Date(c.commit.author.date).toLocaleString()
    }));
  
  // Branch analysis
  const branchingAnalysis = analyzeBranchingPatterns(
    branches,
    graphNodes,
    mergedPRs,
    primaryBranch
  );
  
  // Format branches
  const formattedBranches = branches.map(branch => ({
    name: branch.name,
    isPrimary: branch.name === primaryBranch
  }));
  
  console.log(`✅ Analysis complete!\n`);
  
  return {
    contributors: Array.from(contributors.values()).sort((a, b) => b.commits - a.commits),
    totalCommits: allCommits.length,
    timeRange: getTimeRangeLabel(timeRange),
    primaryBranch: primaryBranch,
    totalBranches: branches.length,
    merges: merges,
    branches: formattedBranches,
    timeline: timeline,
    graph: graphNodes,
    branchingAnalysis: branchingAnalysis
  };
}

module.exports = {
  analyzeGitHubRepo
};