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

function analyzePRActivity(mergedPRs) {
  const prInsights = {
    recentWork: [],
    prTypes: { features: 0, bugfixes: 0, dependencies: 0 }
  };
  
  if (mergedPRs.length === 0) return prInsights;
  
  const workAreaFrequency = new Map();
  
  mergedPRs.forEach(pr => {
    const title = pr.title;
    
    if (/\b(feat|feature|add|new|implement)\b/i.test(title)) prInsights.prTypes.features++;
    else if (/\b(fix|bug|issue|resolve|patch)\b/i.test(title)) prInsights.prTypes.bugfixes++;
    else if (/\b(dep|dependency|bump|upgrade)\b/i.test(title)) prInsights.prTypes.dependencies++;
    
    let workArea = title
      .replace(/^(feat|feature|fix|bug|refactor|docs?|chore|test|perf|ci)(\(.*?\))?:?\s*/i, '')
      .replace(/\b(add|added|update|updated|fix|fixed|improve|improved)\b/gi, '')
      .trim();
    
    const words = workArea.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      workArea = words.slice(0, 4).join(' ').toLowerCase();
      if (workArea.length > 5 && workArea.length < 60) {
        workAreaFrequency.set(workArea, (workAreaFrequency.get(workArea) || 0) + 1);
      }
    }
  });
  
  prInsights.recentWork = Array.from(workAreaFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([area]) => area);
  
  return prInsights;
}

function analyzeCommitMessages(commits) {
  const insights = {
    features: 0,
    bugfixes: 0,
    performance: 0,
    security: 0,
    tests: 0,
    docs: 0,
    refactors: 0,
    topAreas: [],
    technicalDetails: []
  };
  
  if (!commits || commits.length === 0) return insights;
  
  const areaFrequency = new Map();
  const detailFrequency = new Map();
  
  commits.forEach(commitObj => {
    if (!commitObj || !commitObj.commit || !commitObj.commit.message) return;
    
    const message = commitObj.commit.message;
    const firstLine = message.split('\n')[0];
    const lower = firstLine.toLowerCase();
    
    // Categorize
    if (/\b(feat|feature|add|new|implement|introduce)\b/i.test(firstLine)) insights.features++;
    if (/\b(fix|bug|issue|resolve|patch|error)\b/i.test(firstLine)) insights.bugfixes++;
    if (/\b(perf|performance|optimize|speed|faster|slow)\b/i.test(firstLine)) insights.performance++;
    if (/\b(security|vulnerability|cve|auth|safe)\b/i.test(firstLine)) insights.security++;
    if (/\b(test|tests|testing|spec|jest|unit)\b/i.test(firstLine)) insights.tests++;
    if (/\b(doc|docs|documentation|readme|comment)\b/i.test(firstLine)) insights.docs++;
    if (/\b(refactor|restructure|reorganize|cleanup)\b/i.test(firstLine)) insights.refactors++;
    
    // Extract what area/component was changed
    // Look for patterns like "fix(auth): ...", "feat(api): ...", or "Update auth module"
    let area = null;
    
    // Pattern 1: Conventional commits - "type(scope):"
    const conventionalMatch = firstLine.match(/^[a-z]+\(([^)]+)\):/i);
    if (conventionalMatch) {
      area = conventionalMatch[1].toLowerCase();
    }
    
    // Pattern 2: Keywords like "in X", "for X", "to X"
    if (!area) {
      const contextMatch = firstLine.match(/\b(?:in|for|to|of)\s+([a-z]{3,20}(?:\s+[a-z]{3,20})?)/i);
      if (contextMatch) {
        area = contextMatch[1].toLowerCase();
      }
    }
    
    // Pattern 3: Direct mentions of components (first capitalized word after action)
    if (!area) {
      const componentMatch = firstLine.match(/^(?:add|fix|update|improve|remove|create|delete|modify)\s+([A-Z][a-z]+)/);
      if (componentMatch) {
        area = componentMatch[1].toLowerCase();
      }
    }
    
    if (area) {
      // Clean up the area
      area = area.replace(/[^a-z0-9\s]/g, ' ').trim();
      if (area.length > 2 && area.length < 30) {
        areaFrequency.set(area, (areaFrequency.get(area) || 0) + 1);
      }
    }
    
    // Extract technical details (specific nouns/technologies mentioned)
    const words = firstLine
      .replace(/^[a-z]+(\([^)]+\))?:\s*/i, '') // Remove conventional commit prefix
      .split(/\s+/)
      .filter(w => w.length > 3 && /^[A-Za-z]/.test(w));
    
    words.forEach(word => {
      const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length > 3 && clean.length < 20) {
        detailFrequency.set(clean, (detailFrequency.get(clean) || 0) + 1);
      }
    });
  });
  
  // Get top areas
  insights.topAreas = Array.from(areaFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area]) => area);
  
  // Get top technical details (filter out common words)
  const commonWords = new Set(['this', 'that', 'with', 'from', 'have', 'more', 'when', 'been', 'make', 'made', 'use', 'used', 'add', 'added', 'fix', 'fixed', 'update', 'updated']);
  insights.technicalDetails = Array.from(detailFrequency.entries())
    .filter(([word]) => !commonWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([detail]) => detail);
  
  return insights;
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
    const cicdFiles = [
      { path: '.github/workflows', service: 'GitHub Actions' },
      { path: '.gitlab-ci.yml', service: 'GitLab CI' },
      { path: '.travis.yml', service: 'Travis CI' },
      { path: '.circleci/config.yml', service: 'CircleCI' },
      { path: 'Jenkinsfile', service: 'Jenkins' }
    ];
    
    for (const file of cicdFiles) {
      try {
        await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}`);
        tools.cicd.push({ name: file.service, path: file.path, url: `https://github.com/${owner}/${repo}/tree/main/${file.path}` });
      } catch (e) {}
    }
    
    try {
      await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/Dockerfile`);
      tools.containers.push({ name: 'Dockerfile', path: 'Dockerfile', url: `https://github.com/${owner}/${repo}/blob/main/Dockerfile` });
    } catch (e) {}
    
    const testFiles = [
      { path: 'package.json', frameworks: ['jest', 'mocha', 'vitest', 'cypress'] },
      { path: 'requirements.txt', frameworks: ['pytest', 'unittest'] }
    ];
    
    for (const file of testFiles) {
      try {
        const content = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}`);
        if (content.content) {
          const decoded = atob(content.content);
          for (const framework of file.frameworks) {
            if (decoded.toLowerCase().includes(framework)) {
              if (!tools.testing.find(t => t.framework === framework)) {
                tools.testing.push({ framework, file: file.path, url: `https://github.com/${owner}/${repo}/blob/main/${file.path}` });
              }
            }
          }
        }
      } catch (e) {}
    }
    
    const coverageFiles = [
      { path: 'codecov.yml', name: 'Codecov' },
      { path: '.coveragerc', name: 'Coverage.py' }
    ];
    
    for (const file of coverageFiles) {
      try {
        await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}`);
        tools.coverage.push({ name: file.name, path: file.path, url: `https://github.com/${owner}/${repo}/blob/main/${file.path}` });
        break;
      } catch (e) {}
    }
    
    const lintFiles = [
      { path: '.eslintrc', name: 'ESLint' },
      { path: '.eslintrc.js', name: 'ESLint' },
      { path: '.pylintrc', name: 'Pylint' }
    ];
    
    for (const file of lintFiles) {
      try {
        await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}`);
        tools.linting.push({ name: file.name, path: file.path, url: `https://github.com/${owner}/${repo}/blob/main/${file.path}` });
        break;
      } catch (e) {}
    }
    
    try {
      await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/.github/dependabot.yml`);
      tools.security.push({ name: 'Dependabot', path: '.github/dependabot.yml', url: `https://github.com/${owner}/${repo}/blob/main/.github/dependabot.yml` });
    } catch (e) {}
    
  } catch (error) {}
  
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
  
  // Fetch primary branch first without time filter
  const primaryBranchObj = branches.find(b => b.name === primaryBranch);
  if (primaryBranchObj) {
    let branchPage = 1;
    while (branchPage <= 3) {
      const params = { per_page: 100, page: branchPage, sha: primaryBranchObj.name };
      try {
        const commits = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`, params);
        if (commits.length === 0) break;
        
        for (const commit of commits) {
          const commitDate = new Date(commit.commit.author.date);
          const includeCommit = !sinceDate || commitDate >= new Date(sinceDate);
          
          if (includeCommit && !commitMap.has(commit.sha)) {
            commitMap.set(commit.sha, { commit, branches: [primaryBranchObj.name] });
            branchCommitCounts.set(primaryBranchObj.name, (branchCommitCounts.get(primaryBranchObj.name) || 0) + 1);
            if (!branchLastSeen.has(primaryBranchObj.name) || commitDate > branchLastSeen.get(primaryBranchObj.name)) {
              branchLastSeen.set(primaryBranchObj.name, commitDate);
            }
          } else if (includeCommit) {
            commitMap.get(commit.sha).branches.push(primaryBranchObj.name);
          }
        }
        
        if (commits.length > 0 && !activeBranches.find(b => b.name === primaryBranchObj.name)) {
          activeBranches.push(primaryBranchObj);
        }
        
        if (commits.length < 100) break;
        branchPage++;
      } catch (error) {
        break;
      }
    }
  }
  
  // Fetch other branches
  for (const branch of branches.slice(0, 20)) {
    if (branch.name === primaryBranch) continue;
    
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
  
  if (!activeBranches.find(b => b.name === primaryBranch)) {
    const primaryBranchObj = branches.find(b => b.name === primaryBranch);
    if (primaryBranchObj) activeBranches.push(primaryBranchObj);
  }
  
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
  const mergedPRsInRange = mergedPRs.filter(pr => {
    if (!sinceDate) return true;
    return new Date(pr.merged_at) >= new Date(sinceDate);
  });
  
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
  
  const merges = mergedPRsInRange.slice(0, 10).map(pr => ({
    author: pr.user?.login || 'Unknown',
    branchName: pr.head?.ref || 'unknown',
    time: new Date(pr.merged_at).toLocaleString(),
    title: pr.title || 'Merged PR',
    number: pr.number,
    url: pr.html_url
  }));
  
  const branchingAnalysis = analyzeBranchingPatterns(activeBranches, graphNodes, mergedPRs, primaryBranch);
  const cicdTools = await detectCICDTools(owner, repo);
  const prInsights = analyzePRActivity(mergedPRsInRange);
  
  // Analyze commit messages for detailed insights
  const commitInsights = analyzeCommitMessages(allCommits);
  
  // Build rich conversational summary
  const timeLabel = getTimeRangeLabel(timeRange).toLowerCase().replace('last ', '');
  const commitCount = allCommits.length;
  const devCount = contributors.size;
  
  let summary = '';
  
  // Activity level
  if (commitCount === 0) {
    summary = `Quiet ${timeLabel}—no new activity.`;
  } else if (commitCount > 100 && devCount > 15) {
    summary = `Very active ${timeLabel}: ${devCount} developers pushed ${commitCount} commits.`;
  } else if (commitCount > 50) {
    summary = `Busy ${timeLabel}: ${devCount} developers made ${commitCount} changes.`;
  } else if (commitCount > 20) {
    summary = `Steady ${timeLabel}: ${commitCount} commits from ${devCount} ${devCount === 1 ? 'developer' : 'developers'}.`;
  } else {
    summary = `${commitCount} commits from ${devCount} ${devCount === 1 ? 'developer' : 'developers'} this ${timeLabel}.`;
  }
  
  // What got done - from commit analysis
  const highlights = [];
  
  if (commitInsights.features > 2) {
    highlights.push(`${commitInsights.features} features added`);
  } else if (commitInsights.features > 0) {
    highlights.push(`${commitInsights.features} new feature${commitInsights.features > 1 ? 's' : ''}`);
  }
  
  if (commitInsights.bugfixes > 5) {
    highlights.push(`${commitInsights.bugfixes} bugs fixed (stability focus)`);
  } else if (commitInsights.bugfixes > 0) {
    highlights.push(`${commitInsights.bugfixes} bug${commitInsights.bugfixes > 1 ? 's' : ''} fixed`);
  }
  
  if (commitInsights.performance > 2) {
    highlights.push(`performance improvements`);
  }
  
  if (commitInsights.security > 0) {
    highlights.push(`security updates`);
  }
  
  if (highlights.length > 0) {
    summary += ` Work included: ${highlights.join(', ')}.`;
  }
  
  // What they're working on - specific areas
  if (commitInsights.topAreas.length > 0) {
    const areas = commitInsights.topAreas.slice(0, 3);
    if (areas.length === 1) {
      summary += ` Focus: ${areas[0]}.`;
    } else if (areas.length === 2) {
      summary += ` Key areas: ${areas[0]} and ${areas[1]}.`;
    } else {
      summary += ` Active in: ${areas[0]}, ${areas[1]}, and ${areas[2]}.`;
    }
  }
  
  // Add testing/quality signals
  if (commitInsights.tests > commitCount * 0.2) {
    summary += ` Strong testing culture (${Math.round(commitInsights.tests / commitCount * 100)}% of commits include tests).`;
  }
  
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
