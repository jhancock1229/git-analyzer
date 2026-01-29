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
    throw new Error('Invalid GitHub URL');
  }
  return { owner: match[1], repo: match[2] };
}

function getTimeRangeDate(timeRange) {
  const ranges = { day: 1, week: 7, month: 30, quarter: 90, '6months': 180, year: 365 };
  if (timeRange === 'all') return null;
  const days = ranges[timeRange] || 7;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function getTimeRangeLabel(timeRange) {
  const labels = {
    day: 'Last 24 Hours', week: 'Last Week', month: 'Last Month',
    quarter: 'Last Quarter', '6months': 'Last 6 Months', year: 'Last Year', all: 'All Time'
  };
  return labels[timeRange] || 'Last Week';
}

async function analyzeGitHubRepo(owner, repo, timeRange) {
  const sinceDate = getTimeRangeDate(timeRange);
  
  const repoInfo = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}`);
  const primaryBranch = repoInfo.default_branch;
  
  const branches = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches`, { per_page: 100 });
  
  const activeBranches = [];
  const staleBranches = [];
  const branchCommitCounts = new Map();
  const branchLastSeen = new Map();
  
  let allCommits = [];
  const commitMap = new Map();
  
  // Limit to 10 branches to avoid timeout
  for (const branch of branches.slice(0, 10)) {
    let branchPage = 1;
    
    while (branchPage <= 2) {
      const params = { per_page: 100, page: branchPage, sha: branch.name };
      if (sinceDate) params.since = sinceDate;
      
      try {
        const commits = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`, params);
        if (commits.length === 0) break;
        
        for (const commit of commits) {
          if (!commitMap.has(commit.sha)) {
            commitMap.set(commit.sha, { commit, branches: [branch.name] });
            branchCommitCounts.set(branch.name, (branchCommitCounts.get(branch.name) || 0) + 1);
            const commitDate = new Date(commit.commit.author.date);
            if (!branchLastSeen.has(branch.name) || commitDate > branchLastSeen.get(branch.name)) {
              branchLastSeen.set(branch.name, commitDate);
            }
          } else {
            commitMap.get(commit.sha).branches.push(branch.name);
          }
        }
        
        if (commits.length > 0 && !activeBranches.find(b => b.name === branch.name)) {
          activeBranches.push(branch);
        }
        
        if (commits.length < 100) break;
        branchPage++;
      } catch (error) {
        break;
      }
    }
  }
  
  allCommits = Array.from(commitMap.values()).map(item => ({ ...item.commit, branches: item.branches }));
  allCommits.sort((a, b) => new Date(b.commit.author.date) - new Date(a.commit.author.date));
  
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 90);
  
  for (const branch of branches) {
    const lastSeen = branchLastSeen.get(branch.name);
    const isActive = activeBranches.find(b => b.name === branch.name);
    if (!isActive || (lastSeen && lastSeen < staleThreshold)) {
      const daysSince = lastSeen ? Math.floor((new Date() - lastSeen) / 86400000) : 999;
      staleBranches.push({ ...branch, lastCommit: lastSeen ? lastSeen.toISOString() : 'Unknown', daysSinceLastCommit: daysSince });
    }
  }
  
  const pullRequests = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`, { state: 'closed', per_page: 100 });
  const mergedPRs = pullRequests.filter(pr => pr.merged_at);
  
  const contributors = new Map();
  const graphNodes = [];
  
  for (const commit of allCommits) {
    const author = commit.commit.author;
    const email = author.email;
    const name = author.name;
    
    if (!contributors.has(email)) {
      contributors.set(email, { name, email, commits: 0, additions: 0, deletions: 0, branches: [{ name: primaryBranch, isPrimary: true }], merges: 0 });
    }
    contributors.get(email).commits++;
    if (commit.parents && commit.parents.length > 1) contributors.get(email).merges++;
    
    graphNodes.push({
      hash: commit.sha.substring(0, 7),
      fullHash: commit.sha,
      author: name,
      email,
      timestamp: Math.floor(new Date(author.date).getTime() / 1000),
      subject: commit.commit.message.split('\n')[0].substring(0, 50),
      parents: (commit.parents || []).map(p => p.sha.substring(0, 7)),
      branches: commit.branches || [primaryBranch],
      isMerge: commit.parents && commit.parents.length > 1
    });
  }
  
  const merges = allCommits.filter(c => c.parents && c.parents.length > 1).slice(0, 10)
    .map(c => ({ author: c.commit.author.name, branchName: 'merged', time: new Date(c.commit.author.date).toLocaleString() }));
  
  // Branching strategy detection
  const branchingAnalysis = analyzeBranchingPatterns(activeBranches, graphNodes, mergedPRs, primaryBranch);
  
  // Detailed summary with change analysis
  const commitMessages = graphNodes.map(node => node.subject);
  const topContributors = Array.from(contributors.values()).sort((a, b) => b.commits - a.commits).slice(0, 5);
  
  const summary = generateActivitySummary({
    repoDescription: repoInfo.description || '',
    repoName: `${owner}/${repo}`,
    timeRange: getTimeRangeLabel(timeRange),
    totalCommits: allCommits.length,
    contributorCount: contributors.size,
    topContributors,
    commitMessages,
    activeBranches: activeBranches.length,
    staleBranches: staleBranches.length,
    mergeCount: merges.length,
    branchingStrategy: branchingAnalysis.strategy,
    workflow: branchingAnalysis.workflow
  });
  
  return {
    contributors: Array.from(contributors.values()).sort((a, b) => b.commits - a.commits),
    totalCommits: allCommits.length,
    timeRange: getTimeRangeLabel(timeRange),
    primaryBranch,
    totalBranches: activeBranches.length,
    staleBranchesCount: staleBranches.length,
    allBranchesCount: branches.length,
    merges,
    branches: activeBranches.map(b => ({ name: b.name, isPrimary: b.name === primaryBranch, commitCount: branchCommitCounts.get(b.name) || 0, isStale: false })),
    staleBranches: staleBranches.map(b => ({ name: b.name, isPrimary: b.name === primaryBranch, lastCommit: b.lastCommit, daysSinceLastCommit: b.daysSinceLastCommit, isStale: true })),
    timeline: [],
    graph: graphNodes,
    branchingAnalysis,
    activitySummary: summary
  };
}

function analyzeBranchingPatterns(branches, graphNodes, mergedPRs, primaryBranch) {
  const analysis = {
    patterns: [],
    strategy: 'Unknown',
    strategyExplanation: '',
    insights: [],
    workflow: 'Unknown',
    workflowExplanation: '',
    detectionCriteria: [],
    branchCounts: {}
  };
  
  const featureBranches = branches.filter(b => b.name.includes('feature'));
  const bugfixBranches = branches.filter(b => b.name.includes('fix'));
  const developBranches = branches.filter(b => b.name.includes('develop') || b.name.includes('dev'));
  const hotfixBranches = branches.filter(b => b.name.includes('hotfix'));
  const releaseBranches = branches.filter(b => b.name.includes('release'));
  
  analysis.branchCounts = {
    feature: featureBranches.length,
    bugfix: bugfixBranches.length,
    develop: developBranches.length,
    hotfix: hotfixBranches.length,
    release: releaseBranches.length,
    total: branches.length
  };
  
  const totalCommits = graphNodes.length;
  const mergeCommits = graphNodes.filter(n => n.isMerge).length;
  const mergeRatio = totalCommits > 0 ? (mergeCommits / totalCommits * 100).toFixed(1) : 0;
  const prCount = mergedPRs.length;
  const prRatio = totalCommits > 0 ? (prCount / totalCommits * 100).toFixed(1) : 0;
  const { feature, bugfix, develop, hotfix, release, total } = analysis.branchCounts;
  
  if (prCount > 10 || prRatio > 10) {
    analysis.workflow = 'Fork + Pull Request';
    analysis.workflowExplanation = 'Contributors fork the repository and submit pull requests.';
    analysis.detectionCriteria = [`${prCount} merged PRs`, `${prRatio}% PR merge ratio`];
  } else if (total <= 3) {
    analysis.workflow = 'Trunk-Based Development';
    analysis.workflowExplanation = 'Few branches with most work on main.';
    analysis.detectionCriteria = [`Only ${total} branches`];
  } else {
    analysis.workflow = 'Branch-based Development';
    analysis.workflowExplanation = 'Multiple branches with feature workflow.';
    analysis.detectionCriteria = [`${total} active branches`];
  }
  
  if (develop > 0 && (feature > 0 || release > 0)) {
    analysis.strategy = 'Git Flow';
    analysis.strategyExplanation = 'Structured branching with main, develop, and feature/release branches.';
  } else if (feature > 3) {
    analysis.strategy = 'GitHub Flow';
    analysis.strategyExplanation = 'Simple workflow with main as production-ready and feature branches.';
  } else if (total <= 3) {
    analysis.strategy = 'Trunk-Based Development';
    analysis.strategyExplanation = 'Minimal branching with quick merges.';
  } else {
    analysis.strategy = 'Custom Strategy';
    analysis.strategyExplanation = 'Unique branching pattern.';
  }
  
  if (feature > 0) analysis.patterns.push({ type: 'Feature Branches', count: feature });
  if (bugfix > 0) analysis.patterns.push({ type: 'Bugfix Branches', count: bugfix });
  if (hotfix > 0) analysis.patterns.push({ type: 'Hotfix Branches', count: hotfix });
  if (develop > 0) analysis.patterns.push({ type: 'Development Branches', count: develop });
  if (release > 0) analysis.patterns.push({ type: 'Release Branches', count: release });
  
  return analysis;
}

function generateActivitySummary(data) {
  const parts = [];
  
  // Repo description
  if (data.repoDescription && data.repoDescription.length > 10) {
    parts.push(`${data.repoName}: ${data.repoDescription}`);
  } else {
    parts.push(`${data.repoName}`);
  }
  
  // Activity level
  parts.push(`Over ${data.timeRange.toLowerCase()}, the team made ${data.totalCommits} updates with ${data.contributorCount} ${data.contributorCount === 1 ? 'developer' : 'developers'} contributing.`);
  
  // Analyze changes
  if (data.commitMessages && data.commitMessages.length > 0) {
    const changeAnalysis = analyzeChanges(data.commitMessages);
    
    // Deliverables
    const deliverables = [];
    if (changeAnalysis.features > 0) deliverables.push(`${changeAnalysis.features} new features delivered`);
    if (changeAnalysis.improvements > 0) deliverables.push(`${changeAnalysis.improvements} enhancements`);
    if (changeAnalysis.bugfixes > 0) deliverables.push(`${changeAnalysis.bugfixes} issues resolved`);
    
    if (deliverables.length > 0) {
      parts.push(`Key deliverables: ${deliverables.join(', ')}.`);
    }
    
    // Focus areas
    if (changeAnalysis.keywords.length > 0) {
      const focusAreas = changeAnalysis.keywords.slice(0, 5).join(', ');
      parts.push(`Primary focus areas: ${focusAreas}.`);
    }
    
    // Notable impacts
    const impacts = [];
    if (changeAnalysis.performance > 0) impacts.push(`performance improvements (${changeAnalysis.performance})`);
    if (changeAnalysis.security > 0) impacts.push(`security enhancements (${changeAnalysis.security})`);
    if (changeAnalysis.breaking > 0) impacts.push(`⚠️ breaking changes (${changeAnalysis.breaking})`);
    
    if (impacts.length > 0) {
      parts.push(`Notable impacts: ${impacts.join(', ')}.`);
    }
    
    // Quality indicators
    if (changeAnalysis.tests > data.totalCommits * 0.2) {
      parts.push(`Strong testing focus with ${Math.round((changeAnalysis.tests / data.totalCommits) * 100)}% of work including tests.`);
    }
  }
  
  // Top contributors
  if (data.topContributors.length > 0) {
    const topNames = data.topContributors.slice(0, 3).map(c => c.name).join(', ');
    parts.push(`Top contributors: ${topNames}.`);
  }
  
  // Collaboration
  if (data.mergeCount > 5) {
    parts.push(`Strong collaboration with ${data.mergeCount} code reviews and merges.`);
  }
  
  // Stale branches warning
  if (data.staleBranches > 5) {
    parts.push(`⚠️ ${data.staleBranches} inactive branches should be reviewed for cleanup.`);
  }
  
  // Workflow
  parts.push(`The team follows ${data.branchingStrategy} with ${data.workflow.toLowerCase()}.`);
  
  return parts.join(' ');
}

function analyzeChanges(commitMessages) {
  const analysis = {
    keywords: [],
    features: 0,
    bugfixes: 0,
    improvements: 0,
    tests: 0,
    docs: 0,
    performance: 0,
    security: 0,
    breaking: 0
  };
  
  const stopWords = new Set([
    'add', 'added', 'adds', 'update', 'updated', 'updates', 'fix', 'fixed', 'fixes',
    'remove', 'removed', 'removes', 'change', 'changed', 'changes', 'improve', 'improved',
    'merge', 'merged', 'commit', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on',
    'at', 'to', 'for', 'of', 'with', 'from', 'by', 'make', 'made', 'use', 'used'
  ]);
  
  const wordFrequency = new Map();
  
  commitMessages.forEach(msg => {
    const lower = msg.toLowerCase();
    
    // Count change types
    if (/\b(feat|feature|add|new|implement)\b/i.test(msg)) analysis.features++;
    if (/\b(fix|bug|issue|resolve|patch)\b/i.test(msg)) analysis.bugfixes++;
    if (/\b(improve|enhance|better|optimize|upgrade)\b/i.test(msg)) analysis.improvements++;
    if (/\b(test|spec|jest|mocha|unit)\b/i.test(msg)) analysis.tests++;
    if (/\b(doc|docs|documentation|readme)\b/i.test(msg)) analysis.docs++;
    if (/\b(performance|perf|speed|faster)\b/i.test(msg)) analysis.performance++;
    if (/\b(security|vulnerability|cve|auth)\b/i.test(msg)) analysis.security++;
    if (/\b(breaking|break)\b/i.test(msg)) analysis.breaking++;
    
    // Extract keywords
    const words = lower
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    words.forEach(word => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });
  });
  
  // Get top keywords
  analysis.keywords = Array.from(wordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
  
  return analysis;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    const { repoUrl, timeRange } = req.body;
    const { owner, repo } = parseGitHubUrl(repoUrl);
    const data = await analyzeGitHubRepo(owner, repo, timeRange);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
