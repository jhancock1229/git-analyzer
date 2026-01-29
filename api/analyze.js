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

async function detectCICDTools(owner, repo) {
  const tools = {
    cicd: [],
    containers: [],
    testing: [],
    coverage: [],
    linting: [],
    security: []
  };
  
  try {
    // Check for CI/CD config files
    const cicdFiles = [
      { path: '.github/workflows', service: 'GitHub Actions' },
      { path: '.gitlab-ci.yml', service: 'GitLab CI' },
      { path: '.travis.yml', service: 'Travis CI' },
      { path: '.circleci/config.yml', service: 'CircleCI' },
      { path: 'Jenkinsfile', service: 'Jenkins' },
      { path: '.drone.yml', service: 'Drone CI' },
      { path: 'azure-pipelines.yml', service: 'Azure Pipelines' }
    ];
    
    for (const file of cicdFiles) {
      try {
        await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}`);
        tools.cicd.push({ name: file.service, path: file.path, url: `https://github.com/${owner}/${repo}/tree/main/${file.path}` });
      } catch (e) {
        // File doesn't exist
      }
    }
    
    // Check for container files
    try {
      await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/Dockerfile`);
      tools.containers.push({ name: 'Dockerfile', path: 'Dockerfile', url: `https://github.com/${owner}/${repo}/blob/main/Dockerfile` });
    } catch (e) {}
    
    try {
      await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/docker-compose.yml`);
      tools.containers.push({ name: 'docker-compose.yml', path: 'docker-compose.yml', url: `https://github.com/${owner}/${repo}/blob/main/docker-compose.yml` });
    } catch (e) {}
    
    // Check for testing frameworks
    const testFiles = [
      { path: 'package.json', frameworks: ['jest', 'mocha', 'jasmine', 'vitest', 'cypress'] },
      { path: 'requirements.txt', frameworks: ['pytest', 'unittest'] },
      { path: 'pom.xml', frameworks: ['junit'] },
      { path: 'Gemfile', frameworks: ['rspec', 'minitest'] },
      { path: 'go.mod', frameworks: ['testing'] }
    ];
    
    for (const file of testFiles) {
      try {
        const content = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}`);
        if (content.content) {
          const decoded = atob(content.content);
          for (const framework of file.frameworks) {
            if (decoded.toLowerCase().includes(framework)) {
              if (!tools.testing.find(t => t.framework === framework)) {
                tools.testing.push({ 
                  framework, 
                  file: file.path, 
                  url: `https://github.com/${owner}/${repo}/blob/main/${file.path}` 
                });
              }
            }
          }
        }
      } catch (e) {}
    }
    
    // Check for coverage tools
    const coverageFiles = [
      { path: 'codecov.yml', name: 'Codecov' },
      { path: '.coveragerc', name: 'Coverage.py' },
      { path: '.nycrc', name: 'nyc' },
      { path: 'package.json', name: 'Coverage config' }
    ];
    
    for (const file of coverageFiles) {
      try {
        await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}`);
        tools.coverage.push({ 
          name: file.name, 
          path: file.path, 
          url: `https://github.com/${owner}/${repo}/blob/main/${file.path}` 
        });
        break; // Only add one
      } catch (e) {}
    }
    
    // Check for linting
    const lintFiles = [
      { path: '.eslintrc', name: 'ESLint' },
      { path: '.eslintrc.js', name: 'ESLint' },
      { path: '.eslintrc.json', name: 'ESLint' },
      { path: '.pylintrc', name: 'Pylint' },
      { path: '.rubocop.yml', name: 'RuboCop' },
      { path: 'golangci.yml', name: 'GolangCI' },
      { path: 'tslint.json', name: 'TSLint' }
    ];
    
    for (const file of lintFiles) {
      try {
        await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}`);
        tools.linting.push({ 
          name: file.name, 
          path: file.path, 
          url: `https://github.com/${owner}/${repo}/blob/main/${file.path}` 
        });
        break; // Only add one
      } catch (e) {}
    }
    
    // Check for security scanning
    try {
      await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/.github/dependabot.yml`);
      tools.security.push({ 
        name: 'Dependabot', 
        path: '.github/dependabot.yml', 
        url: `https://github.com/${owner}/${repo}/blob/main/.github/dependabot.yml` 
      });
    } catch (e) {}
    
    try {
      await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/.snyk`);
      tools.security.push({ 
        name: 'Snyk', 
        path: '.snyk', 
        url: `https://github.com/${owner}/${repo}/blob/main/.snyk` 
      });
    } catch (e) {}
    
  } catch (error) {
    // If detection fails, return empty tools
  }
  
  return tools;
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
  
  // Increase to 20 branches and 3 pages per branch for more complete data
  for (const branch of branches.slice(0, 20)) {
    let branchPage = 1;
    
    while (branchPage <= 3) {
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
  
  const branchingAnalysis = analyzeBranchingPatterns(activeBranches, graphNodes, mergedPRs, primaryBranch);
  
  // Detect CI/CD and tooling
  const cicdTools = await detectCICDTools(owner, repo);
  
  // Build summary WITHOUT CI/CD info
  const summary = `${repoInfo.description || `${owner}/${repo}`} - Over ${getTimeRangeLabel(timeRange).toLowerCase()}, the team made ${allCommits.length} updates with ${contributors.size} ${contributors.size === 1 ? 'developer' : 'developers'} contributing. The team follows ${branchingAnalysis.strategy} with ${branchingAnalysis.workflow.toLowerCase()}.`;
  
  return {
    contributors: Array.from(contributors.values()).sort((a, b) => b.commits - a.commits),
    totalCommits: allCommits.length,
    timeRange: getTimeRangeLabel(timeRange),
    primaryBranch,
    primaryBranchUrl: `https://github.com/${owner}/${repo}/tree/${primaryBranch}`,
    totalBranches: activeBranches.length,
    staleBranchesCount: staleBranches.length,
    allBranchesCount: branches.length,
    merges,
    branches: activeBranches.map(b => ({ name: b.name, isPrimary: b.name === primaryBranch, commitCount: branchCommitCounts.get(b.name) || 0, isStale: false })),
    staleBranches: staleBranches.map(b => ({ name: b.name, isPrimary: b.name === primaryBranch, lastCommit: b.lastCommit, daysSinceLastCommit: b.daysSinceLastCommit, isStale: true })),
    timeline: [],
    graph: graphNodes,
    branchingAnalysis,
    activitySummary: summary,
    cicdTools
  };
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
