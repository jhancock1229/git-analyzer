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
    breaking: 0,
    topAreas: [],
    technicalDetails: [],
    specificChanges: [], // Actual things that were done
    qualitySignals: {
      hasTests: 0,
      hasDocs: 0,
      hasReviews: 0
    }
  };
  
  if (!commits || commits.length === 0) return insights;
  
  const areaFrequency = new Map();
  const changeDescriptions = new Map();
  
  commits.forEach(commitObj => {
    if (!commitObj || !commitObj.commit || !commitObj.commit.message) return;
    
    const message = commitObj.commit.message;
    const firstLine = message.split('\n')[0];
    const fullMessage = message.toLowerCase();
    const lower = firstLine.toLowerCase();
    
    // Categorize types
    if (/\b(feat|feature|add|new|implement|introduce|create)\b/i.test(firstLine)) insights.features++;
    if (/\b(fix|bug|issue|resolve|patch|error|correct)\b/i.test(firstLine)) insights.bugfixes++;
    if (/\b(perf|performance|optimize|speed|faster|slow|improve.*speed)\b/i.test(firstLine)) insights.performance++;
    if (/\b(security|vulnerability|cve|auth|safe|xss|csrf)\b/i.test(firstLine)) insights.security++;
    if (/\b(test|tests|testing|spec|jest|unit|coverage)\b/i.test(fullMessage)) insights.tests++;
    if (/\b(doc|docs|documentation|readme|comment|guide)\b/i.test(fullMessage)) insights.docs++;
    if (/\b(refactor|restructure|reorganize|cleanup|clean up)\b/i.test(firstLine)) insights.refactors++;
    if (/\b(breaking|break|deprecated|deprecate)\b/i.test(fullMessage)) insights.breaking++;
    
    // Quality signals
    if (/\b(test|tests|testing|spec)\b/i.test(fullMessage)) insights.qualitySignals.hasTests++;
    if (/\b(doc|docs|documentation)\b/i.test(fullMessage)) insights.qualitySignals.hasDocs++;
    if (/\b(review|reviewed|approved|lgtm)\b/i.test(fullMessage)) insights.qualitySignals.hasReviews++;
    
    // Extract area/component being changed
    let area = null;
    
    // Pattern 1: Conventional commits - "type(scope):"
    const conventionalMatch = firstLine.match(/^[a-z]+\(([^)]+)\):/i);
    if (conventionalMatch) {
      area = conventionalMatch[1].toLowerCase().trim();
    }
    
    // Pattern 2: "Fix X bug", "Update X", "Add X support"
    if (!area) {
      const patterns = [
        /(?:fix|update|add|improve|remove|delete|create)\s+([a-z]{3,20}(?:\s+[a-z]{3,20})?)/i,
        /\b(?:in|for|to|of)\s+([a-z]{3,20}(?:\s+[a-z]{3,20})?)/i
      ];
      
      for (const pattern of patterns) {
        const match = firstLine.match(pattern);
        if (match && match[1]) {
          const candidate = match[1].toLowerCase().trim();
          if (!['the', 'a', 'an', 'this', 'that'].includes(candidate)) {
            area = candidate;
            break;
          }
        }
      }
    }
    
    if (area) {
      area = area.replace(/[^a-z0-9\s]/g, ' ').trim();
      if (area.length > 2 && area.length < 40) {
        areaFrequency.set(area, (areaFrequency.get(area) || 0) + 1);
      }
    }
    
    // Extract specific changes - what was actually done
    const cleanMessage = firstLine
      .replace(/^(feat|feature|fix|bug|refactor|docs?|chore|test|style|perf|ci|build)(\([^)]+\))?:?\s*/i, '')
      .trim();
    
    if (cleanMessage.length > 10 && cleanMessage.length < 100) {
      changeDescriptions.set(cleanMessage, (changeDescriptions.get(cleanMessage) || 0) + 1);
    }
  });
  
  // Get top areas
  insights.topAreas = Array.from(areaFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area, count]) => ({ area, count }));
  
  // Get most common specific changes
  insights.specificChanges = Array.from(changeDescriptions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([change]) => change);
  
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
  
  // Build rich, detailed conversational summary
  const timeLabel = getTimeRangeLabel(timeRange).toLowerCase().replace('last ', '');
  const commitCount = allCommits.length;
  const devCount = contributors.size;
  
  const parts = [];
  
  // Opening - activity level with context
  if (commitCount === 0) {
    parts.push(`No activity this ${timeLabel}.`);
  } else {
    // Describe velocity and team size
    let velocity = '';
    if (commitCount > 100 && devCount > 15) {
      velocity = `High velocity development with ${devCount} active contributors making ${commitCount} commits`;
    } else if (commitCount > 50) {
      velocity = `Active development: ${devCount} ${devCount === 1 ? 'developer' : 'developers'} pushed ${commitCount} commits`;
    } else if (commitCount > 20) {
      velocity = `Steady progress with ${commitCount} commits from ${devCount} ${devCount === 1 ? 'contributor' : 'contributors'}`;
    } else {
      velocity = `${commitCount} commits from ${devCount} ${devCount === 1 ? 'developer' : 'developers'}`;
    }
    parts.push(`${velocity} this ${timeLabel}.`);
  }
  
  if (commitCount > 0) {
    // What type of work was done
    const workTypes = [];
    if (commitInsights.features > 0) {
      if (commitInsights.features > 10) {
        workTypes.push(`heavy feature development (${commitInsights.features} features)`);
      } else {
        workTypes.push(`${commitInsights.features} new feature${commitInsights.features > 1 ? 's' : ''}`);
      }
    }
    
    if (commitInsights.bugfixes > 0) {
      if (commitInsights.bugfixes > commitInsights.features * 2) {
        workTypes.push(`${commitInsights.bugfixes} bug fixes—indicating a stabilization phase`);
      } else if (commitInsights.bugfixes > 10) {
        workTypes.push(`${commitInsights.bugfixes} issues resolved`);
      } else {
        workTypes.push(`${commitInsights.bugfixes} bug fix${commitInsights.bugfixes > 1 ? 'es' : ''}`);
      }
    }
    
    if (commitInsights.refactors > 5) {
      workTypes.push(`significant refactoring (${commitInsights.refactors} commits)`);
    }
    
    if (commitInsights.performance > 0) {
      workTypes.push(`${commitInsights.performance} performance optimization${commitInsights.performance > 1 ? 's' : ''}`);
    }
    
    if (commitInsights.security > 0) {
      workTypes.push(`${commitInsights.security} security update${commitInsights.security > 1 ? 's' : ''}`);
    }
    
    if (workTypes.length > 0) {
      parts.push(`Work included: ${workTypes.join(', ')}.`);
    }
    
    // Where the work happened
    if (commitInsights.topAreas && commitInsights.topAreas.length > 0) {
      const areaDescriptions = commitInsights.topAreas.map(item => {
        const { area, count } = item || { area: 'unknown', count: 0 };
        if (count > 10) return `${area} (${count} commits—major focus)`;
        if (count > 5) return `${area} (${count} commits)`;
        return area;
      });
      
      if (areaDescriptions.length === 1) {
        parts.push(`All work concentrated in ${areaDescriptions[0]}.`);
      } else if (areaDescriptions.length === 2) {
        parts.push(`Primary areas: ${areaDescriptions[0]} and ${areaDescriptions[1]}.`);
      } else {
        parts.push(`Active development across: ${areaDescriptions.join(', ')}.`);
      }
    }
    
    // Specific notable changes
    if (commitInsights.specificChanges && commitInsights.specificChanges.length > 0) {
      const highlights = commitInsights.specificChanges.slice(0, 3).filter(Boolean);
      if (highlights.length > 0) {
        parts.push(`Notable changes: ${highlights.join('; ')}.`);
      }
    }
    
    // Quality and process signals
    const qualityNotes = [];
    
    if (commitInsights.qualitySignals && commitInsights.qualitySignals.hasTests !== undefined) {
      const testPercentage = Math.round((commitInsights.qualitySignals.hasTests / commitCount) * 100);
      if (testPercentage > 40) {
        qualityNotes.push(`excellent test coverage (${testPercentage}% of commits include tests)`);
      } else if (testPercentage > 20) {
        qualityNotes.push(`good testing discipline (${testPercentage}% of commits have tests)`);
      }
    }
    
    if (commitInsights.qualitySignals && commitInsights.qualitySignals.hasDocs !== undefined) {
      const docPercentage = Math.round((commitInsights.qualitySignals.hasDocs / commitCount) * 100);
      if (docPercentage > 15) {
        qualityNotes.push(`strong documentation practice`);
      }
    }
    
    if (commitInsights.breaking > 0) {
      qualityNotes.push(`⚠️ ${commitInsights.breaking} breaking change${commitInsights.breaking > 1 ? 's' : ''} requiring attention`);
    }
    
    if (qualityNotes.length > 0) {
      parts.push(`Quality: ${qualityNotes.join(', ')}.`);
    }
    
    // Team collaboration signal
    if (devCount > 10) {
      parts.push(`Large, distributed team collaboration.`);
    } else if (devCount > 5) {
      parts.push(`Cross-functional team of ${devCount} contributors.`);
    } else if (devCount === 1) {
      const soloContributor = Array.from(contributors.values())[0];
      parts.push(`Solo development by ${soloContributor.name}.`);
    }
  }
  
  const summary = parts.join(' ');
  
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
