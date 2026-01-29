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
    
    // Categorize PR type
    if (/\b(feat|feature|add|new|implement)\b/i.test(title)) prInsights.prTypes.features++;
    else if (/\b(fix|bug|issue|resolve|patch)\b/i.test(title)) prInsights.prTypes.bugfixes++;
    else if (/\b(dep|dependency|bump|upgrade)\b/i.test(title)) prInsights.prTypes.dependencies++;
    
    // Extract work area (what was changed)
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

async function analyzeMostRecentCommit(owner, repo, primaryBranch) {
  try {
    // Get the most recent commit on primary branch
    const commits = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`, { 
      sha: primaryBranch, 
      per_page: 1 
    });
    
    if (commits.length === 0) return null;
    
    const latestCommit = commits[0];
    const commitSha = latestCommit.sha;
    
    // Get the commit details with file changes
    const commitDetails = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${commitSha}`);
    
    const analysis = {
      message: commitDetails.commit.message,
      author: commitDetails.commit.author.name,
      date: commitDetails.commit.author.date,
      filesChanged: commitDetails.files?.length || 0,
      additions: commitDetails.stats?.additions || 0,
      deletions: commitDetails.stats?.deletions || 0,
      changes: [],
      affectedAreas: new Set(),
      changeTypes: {
        newFiles: 0,
        deletedFiles: 0,
        modifiedFiles: 0
      }
    };
    
    // Analyze each file that changed
    if (commitDetails.files) {
      commitDetails.files.forEach(file => {
        const filename = file.filename;
        const status = file.status; // 'added', 'removed', 'modified'
        
        // Track change type
        if (status === 'added') analysis.changeTypes.newFiles++;
        else if (status === 'removed') analysis.changeTypes.deletedFiles++;
        else analysis.changeTypes.modifiedFiles++;
        
        // Determine what area of codebase was affected
        const pathParts = filename.split('/');
        
        // Get directory/module
        if (pathParts.length > 1) {
          const area = pathParts[0];
          if (area !== '.' && area.length > 0) {
            analysis.affectedAreas.add(area);
          }
        }
        
        // Categorize by file type
        const ext = filename.split('.').pop();
        let fileType = 'code';
        
        if (['md', 'txt', 'rst'].includes(ext)) fileType = 'documentation';
        else if (['yml', 'yaml', 'json', 'toml', 'xml', 'ini', 'cfg'].includes(ext)) fileType = 'configuration';
        else if (['test', 'spec'].some(t => filename.includes(t))) fileType = 'tests';
        else if (['py', 'js', 'ts', 'java', 'cpp', 'c', 'go', 'rs', 'rb'].includes(ext)) fileType = 'source code';
        
        analysis.changes.push({
          filename,
          status,
          additions: file.additions,
          deletions: file.deletions,
          fileType
        });
      });
    }
    
    analysis.affectedAreas = Array.from(analysis.affectedAreas);
    
    // Generate human-readable description
    let description = '';
    
    // Scale of change
    const totalChanges = analysis.additions + analysis.deletions;
    if (totalChanges > 500) {
      description = 'Major update';
    } else if (totalChanges > 100) {
      description = 'Significant changes';
    } else if (totalChanges > 20) {
      description = 'Moderate update';
    } else {
      description = 'Small tweak';
    }
    
    // What changed
    const { newFiles, deletedFiles, modifiedFiles } = analysis.changeTypes;
    const changeParts = [];
    
    if (newFiles > 0) changeParts.push(`${newFiles} new ${newFiles === 1 ? 'file' : 'files'}`);
    if (deletedFiles > 0) changeParts.push(`${deletedFiles} ${deletedFiles === 1 ? 'file' : 'files'} removed`);
    if (modifiedFiles > 0) changeParts.push(`${modifiedFiles} ${modifiedFiles === 1 ? 'file' : 'files'} modified`);
    
    if (changeParts.length > 0) {
      description += ` (${changeParts.join(', ')})`;
    }
    
    // Where
    if (analysis.affectedAreas.length > 0) {
      if (analysis.affectedAreas.length === 1) {
        description += ` in ${analysis.affectedAreas[0]}`;
      } else if (analysis.affectedAreas.length <= 3) {
        description += ` across ${analysis.affectedAreas.join(', ')}`;
      } else {
        description += ` across ${analysis.affectedAreas.length} modules`;
      }
    }
    
    // Type breakdown
    const fileTypes = {};
    analysis.changes.forEach(change => {
      fileTypes[change.fileType] = (fileTypes[change.fileType] || 0) + 1;
    });
    
    const typeDescriptions = [];
    if (fileTypes['source code']) typeDescriptions.push('code');
    if (fileTypes['tests']) typeDescriptions.push('tests');
    if (fileTypes['documentation']) typeDescriptions.push('docs');
    if (fileTypes['configuration']) typeDescriptions.push('config');
    
    if (typeDescriptions.length > 0) {
      description += `. Touched ${typeDescriptions.join(', ')}.`;
    }
    
    analysis.humanDescription = description;
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing recent commit:', error);
    return null;
  }
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
  // ALWAYS fetch primary branch first without time filter to ensure we get recent commits
  const primaryBranchObj = branches.find(b => b.name === primaryBranch);
  if (primaryBranchObj) {
    let branchPage = 1;
    while (branchPage <= 3) {
      const params = { per_page: 100, page: branchPage, sha: primaryBranchObj.name };
      // Don't apply time filter for primary branch to always show recent activity
      
      try {
        const commits = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`, params);
        if (commits.length === 0) break;
        
        for (const commit of commits) {
          const commitDate = new Date(commit.commit.author.date);
          
          // Only include if within time range OR always include if no time range specified
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
  
  // Now fetch other branches
  for (const branch of branches.slice(0, 20)) {
    if (branch.name === primaryBranch) continue; // Skip primary, already fetched
    
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
  
  // Always ensure primary branch is in active branches
  if (!activeBranches.find(b => b.name === primaryBranch)) {
    const primaryBranchObj = branches.find(b => b.name === primaryBranch);
    if (primaryBranchObj) {
      activeBranches.push(primaryBranchObj);
    }
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
  
  // Filter merged PRs by time range
  const mergedPRsInRange = mergedPRs.filter(pr => {
    if (!sinceDate) return true;
    const mergedDate = new Date(pr.merged_at);
    return mergedDate >= new Date(sinceDate);
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
  
  // Create merge list from merged PRs (more accurate than merge commits)
  const merges = mergedPRsInRange.slice(0, 10).map(pr => ({
    author: pr.user?.login || 'Unknown',
    branchName: pr.head?.ref || 'unknown',
    time: new Date(pr.merged_at).toLocaleString(),
    title: pr.title || 'Merged PR',
    number: pr.number,
    url: pr.html_url
  }));
  
  const branchingAnalysis = analyzeBranchingPatterns(activeBranches, graphNodes, mergedPRs, primaryBranch);
  
  // Detect CI/CD and tooling
  const cicdTools = await detectCICDTools(owner, repo);
  
  // Analyze the most recent commit on primary branch
  const recentCommitAnalysis = await analyzeMostRecentCommit(owner, repo, primaryBranch);
  
  // Analyze PR activity for recent work context
  const prInsights = analyzePRActivity(mergedPRsInRange);
  
  // Build conversational executive summary
  let summary = '';
  
  const timeLabel = getTimeRangeLabel(timeRange).toLowerCase().replace('last ', '').replace('all time', 'historically');
  const commitCount = allCommits.length;
  const devCount = contributors.size;
  
  // Most recent change context
  if (recentCommitAnalysis) {
    const timeSince = Math.floor((new Date() - new Date(recentCommitAnalysis.date)) / (1000 * 60));
    let timeAgo = '';
    
    if (timeSince < 60) {
      timeAgo = `${timeSince} ${timeSince === 1 ? 'minute' : 'minutes'} ago`;
    } else if (timeSince < 1440) {
      const hours = Math.floor(timeSince / 60);
      timeAgo = `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      const days = Math.floor(timeSince / 1440);
      timeAgo = `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    
    summary = `Latest: ${recentCommitAnalysis.humanDescription} (${timeAgo}). `;
  }
  
  // Start with activity level in plain English
  if (commitCount === 0) {
    summary = `Things have been quiet ${timeLabel === 'historically' ? 'lately' : `this ${timeLabel}`}—no new activity to report.`;
  } else {
    // Describe what's happening
    if (commitCount > 100 && devCount > 15) {
      summary = `This has been a busy ${timeLabel} with ${devCount} developers pushing ${commitCount} commits.`;
    } else if (commitCount > 50) {
      summary = `Solid development activity this ${timeLabel}—${devCount} ${devCount === 1 ? 'developer' : 'developers'} committed ${commitCount} changes.`;
    } else if (commitCount > 20) {
      summary = `Steady progress this ${timeLabel} with ${commitCount} commits from ${devCount} ${devCount === 1 ? 'contributor' : 'contributors'}.`;
    } else {
      summary = `Light activity this ${timeLabel}—${commitCount} commits from ${devCount} ${devCount === 1 ? 'developer' : 'developers'}.`;
    }
    
    // What actually got done
    if (mergedPRsInRange.length > 0) {
      const { features, bugfixes, dependencies } = prInsights.prTypes;
      
      if (features > 5 && bugfixes > 5) {
        summary += ` The team's been balancing new feature work (${features} shipped) with keeping things stable (${bugfixes} bugs squashed).`;
      } else if (features > 0 && bugfixes > 0) {
        summary += ` ${features} new ${features === 1 ? 'feature' : 'features'} shipped and ${bugfixes} ${bugfixes === 1 ? 'bug' : 'bugs'} fixed.`;
      } else if (features > 3) {
        summary += ` Feature development is the focus right now—${features} new capabilities added.`;
      } else if (features > 0) {
        summary += ` Added ${features} new ${features === 1 ? 'feature' : 'features'}.`;
      } else if (bugfixes > 5) {
        summary += ` Major focus on stability and quality—${bugfixes} issues resolved.`;
      } else if (bugfixes > 0) {
        summary += ` Fixed ${bugfixes} ${bugfixes === 1 ? 'bug' : 'bugs'}.`;
      }
      
      // What areas they're working in
      if (prInsights.recentWork.length > 0) {
        const top3 = prInsights.recentWork.slice(0, 3);
        if (top3.length === 1) {
          summary += ` Most work is going into ${top3[0]}.`;
        } else if (top3.length === 2) {
          summary += ` Key focus areas: ${top3[0]} and ${top3[1]}.`;
        } else {
          summary += ` Main areas of work: ${top3[0]}, ${top3[1]}, and ${top3[2]}.`;
        }
      }
    }
  }
  
  const fullSummary = summary;
  
  
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
    activitySummary: fullSummary,
    cicdTools,
    recentCommitAnalysis
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
