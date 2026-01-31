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

function generateBranchActivityReport(activeBranches, branchCommitCounts, primaryBranch, timeRange) {
  if (!activeBranches || activeBranches.length === 0) {
    return null;
  }
  
  const report = [];
  
  report.push('## 🌿 Active Branches');
  report.push('');
  
  // Sort branches by commit count
  const branchesWithActivity = activeBranches
    .map(branch => ({
      name: branch.name,
      commitCount: branchCommitCounts.get(branch.name) || 0,
      isPrimary: branch.name === primaryBranch
    }))
    .filter(b => b.commitCount > 0)
    .sort((a, b) => b.commitCount - a.commitCount);
  
  if (branchesWithActivity.length === 0) {
    return null;
  }
  
  const timeLabel = getTimeRangeLabel(timeRange).toLowerCase();
  report.push(`**${branchesWithActivity.length} branch${branchesWithActivity.length !== 1 ? 'es' : ''} with activity this ${timeLabel}:**`);
  report.push('');
  
  // Show top 10 most active branches
  const topBranches = branchesWithActivity.slice(0, 10);
  
  topBranches.forEach((branch, idx) => {
    const icon = branch.isPrimary ? '⭐' : '📍';
    const label = branch.isPrimary ? ` (primary)` : '';
    const barLength = Math.max(1, Math.floor((branch.commitCount / topBranches[0].commitCount) * 20));
    const bar = '█'.repeat(barLength);
    
    report.push(`${idx + 1}. ${icon} **${branch.name}**${label}`);
    report.push(`   ${bar} ${branch.commitCount} commit${branch.commitCount !== 1 ? 's' : ''}`);
    report.push('');
  });
  
  if (branchesWithActivity.length > 10) {
    report.push(`*...and ${branchesWithActivity.length - 10} other active branch${branchesWithActivity.length - 10 !== 1 ? 'es' : ''}*`);
    report.push('');
  }
  
  return report.join('\n');
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

async function analyzeRecentCodeChanges(owner, repo, recentCommits, limit = 10) {
  if (!recentCommits || recentCommits.length === 0) {
    return { narrative: 'No commits found in the selected time period.' };
  }
  
  console.log(`[NARRATIVE] Total commits available: ${recentCommits.length}`);
  
  // Always generate narrative - even if we can't get detailed file info
  try {
    // Try to get detailed commits with file changes
    const commitsToAnalyze = recentCommits.slice(0, Math.min(limit, recentCommits.length));
    
    const commitDetails = await Promise.allSettled(
      commitsToAnalyze.map(commit => 
        githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${commit.sha}`)
          .catch(() => null)
      )
    );
    
    const detailedCommits = [];
    commitDetails.forEach((result) => {
      if (result.status !== 'fulfilled' || !result.value?.files) return;
      
      const commit = result.value;
      detailedCommits.push({
        message: commit.commit.message.split('\n')[0],
        author: commit.commit.author.name,
        date: new Date(commit.commit.author.date),
        sha: commit.sha.substring(0, 7),
        files: commit.files.map(f => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions || 0,
          deletions: f.deletions || 0
        }))
      });
    });
    
    console.log(`[NARRATIVE] Got ${detailedCommits.length} detailed commits`);
    
    // Generate narrative - use detailed commits if available, otherwise use basic list
    const narrative = detailedCommits.length > 0 
      ? generateDetailedNarrative(detailedCommits, recentCommits, owner, repo)
      : generateBasicNarrative(recentCommits, owner, repo);
    
    return { narrative };
    
  } catch (error) {
    console.error('[NARRATIVE] Error:', error);
    // Fallback to basic narrative
    return { narrative: generateBasicNarrative(recentCommits, owner, repo) };
  }
}

function generateDetailedNarrative(detailedCommits, allCommits, owner, repo) {
  const story = [];
  
  story.push(`# Development Activity: ${owner}/${repo}`);
  story.push('');
  story.push(`**${allCommits.length} commits** in this period`);
  story.push('');
  story.push('---');
  story.push('');
  
  // Analyze work areas from file changes
  const workAreas = analyzeWorkAreas(detailedCommits);
  
  story.push('## 🔥 Active Development Areas:');
  story.push('');
  
  Object.entries(workAreas)
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([area, data]) => {
      story.push(`**${area}** (${data.count} commits)`);
      story.push(data.description);
      if (data.examples.length > 0) {
        data.examples.slice(0, 2).forEach(ex => {
          story.push(`- ${ex}`);
        });
      }
      story.push('');
    });
  
  // Recent commits
  story.push('---');
  story.push('');
  story.push('## Recent Commits:');
  story.push('');
  
  detailedCommits.slice(0, 8).forEach((commit, idx) => {
    story.push(`${idx + 1}. **${commit.message}**`);
    story.push(`   *${commit.author}*`);
    if (commit.files && commit.files.length > 0) {
      const fileTypes = {};
      commit.files.forEach(f => {
        const type = getFileType(f.filename);
        fileTypes[type] = (fileTypes[type] || 0) + 1;
      });
      const parts = Object.entries(fileTypes).map(([t, c]) => `${c} ${t}`);
      story.push(`   Changed: ${parts.join(', ')}`);
    }
    story.push('');
  });
  
  return story.join('\n');
}

function generateBasicNarrative(commits, owner, repo) {
  const story = [];
  
  story.push(`# Development Activity: ${owner}/${repo}`);
  story.push('');
  story.push(`**${commits.length} commits** in this period`);
  story.push('');
  story.push('---');
  story.push('');
  
  // Categorize by commit messages
  const categories = categorizeByMessage(commits.slice(0, 50));
  
  story.push('## Work Categories:');
  story.push('');
  
  Object.entries(categories)
    .filter(([_, items]) => items.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([category, items]) => {
      story.push(`**${category}** (${items.length} commits)`);
      items.slice(0, 3).forEach(msg => {
        story.push(`- ${msg}`);
      });
      if (items.length > 3) {
        story.push(`- ...and ${items.length - 3} more`);
      }
      story.push('');
    });
  
  return story.join('\n');
}

function analyzeWorkAreas(commits) {
  const areas = {
    'GPU & Accelerator Support': { count: 0, description: 'CUDA, ROCm, Intel XPU, and other GPU backend improvements', examples: [] },
    'Performance & Optimization': { count: 0, description: 'Compiler improvements, kernel optimizations, speed enhancements', examples: [] },
    'Distributed Computing': { count: 0, description: 'Distributed tensors, parallelization, multi-device coordination', examples: [] },
    'Core Framework': { count: 0, description: 'Core PyTorch APIs, operators, and framework functionality', examples: [] },
    'Testing & CI/CD': { count: 0, description: 'Test coverage, continuous integration, build infrastructure', examples: [] },
    'Bug Fixes & Stability': { count: 0, description: 'Issue resolution, crash fixes, stability improvements', examples: [] }
  };
  
  commits.forEach(commit => {
    const msg = commit.message.toLowerCase();
    const files = commit.files.map(f => f.filename.toLowerCase()).join(' ');
    
    if (msg.match(/cuda|rocm|xpu|gpu|intel|amd|nvidia/) || files.match(/cuda|rocm|xpu/)) {
      areas['GPU & Accelerator Support'].count++;
      if (areas['GPU & Accelerator Support'].examples.length < 3) {
        areas['GPU & Accelerator Support'].examples.push(commit.message);
      }
    } else if (msg.match(/perf|optim|speed|fast|inductor|compiler/)) {
      areas['Performance & Optimization'].count++;
      if (areas['Performance & Optimization'].examples.length < 3) {
        areas['Performance & Optimization'].examples.push(commit.message);
      }
    } else if (msg.match(/distribut|dtensor|parallel|shard/) || files.match(/distributed|dtensor/)) {
      areas['Distributed Computing'].count++;
      if (areas['Distributed Computing'].examples.length < 3) {
        areas['Distributed Computing'].examples.push(commit.message);
      }
    } else if (msg.match(/test|ci|build/) || files.match(/test|ci/)) {
      areas['Testing & CI/CD'].count++;
      if (areas['Testing & CI/CD'].examples.length < 3) {
        areas['Testing & CI/CD'].examples.push(commit.message);
      }
    } else if (msg.match(/fix|bug|crash|error/)) {
      areas['Bug Fixes & Stability'].count++;
      if (areas['Bug Fixes & Stability'].examples.length < 3) {
        areas['Bug Fixes & Stability'].examples.push(commit.message);
      }
    } else {
      areas['Core Framework'].count++;
      if (areas['Core Framework'].examples.length < 3) {
        areas['Core Framework'].examples.push(commit.message);
      }
    }
  });
  
  return areas;
}

function categorizeByMessage(commits) {
  const categories = {
    'Features & Enhancements': [],
    'Bug Fixes': [],
    'Performance': [],
    'Testing': [],
    'Documentation': [],
    'Refactoring': []
  };
  
  commits.forEach(commit => {
    const msg = (commit.commit?.message || commit.message || '').split('\n')[0];
    const lower = msg.toLowerCase();
    
    if (lower.match(/feat|add|implement|support|enable/)) {
      categories['Features & Enhancements'].push(msg);
    } else if (lower.match(/fix|bug|crash|error/)) {
      categories['Bug Fixes'].push(msg);
    } else if (lower.match(/perf|optim|speed|fast/)) {
      categories['Performance'].push(msg);
    } else if (lower.match(/test|ci/)) {
      categories['Testing'].push(msg);
    } else if (lower.match(/doc|readme/)) {
      categories['Documentation'].push(msg);
    } else if (lower.match(/refactor|clean|remove/)) {
      categories['Refactoring'].push(msg);
    }
  });
  
  return categories;
}

function getFileType(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.py')) return 'Python';
  if (lower.match(/\.cpp$|\.cu$|\.h$/)) return 'C++/CUDA';
  if (lower.match(/\.js$|\.ts$/)) return 'JavaScript/TypeScript';
  if (lower.match(/test/)) return 'tests';
  if (lower.match(/\.yml$|\.yaml$/)) return 'config';
  return 'other files';
}
function analyzeCommitMessages(commits, owner, repo) {
  const insights = {
    features: 0,
    bugfixes: 0,
    performance: 0,
    security: 0,
    tests: 0,
    docs: 0,
    refactors: 0,
    breaking: 0,
    breakingChanges: [], // Array of breaking change commits with URLs
    topAreas: [],
    technicalDetails: [],
    specificChanges: [],
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
    
    // Track breaking changes with full details
    if (/\b(breaking|break|deprecated|deprecate)\b/i.test(fullMessage)) {
      insights.breaking++;
      insights.breakingChanges.push({
        hash: commitObj.hash,
        fullHash: commitObj.fullHash,
        subject: commitObj.subject,
        author: commitObj.author,
        url: `https://github.com/${owner}/${repo}/commit/${commitObj.fullHash}`
      });
    }
    
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
    // Strategy: Check all files in PARALLEL using Promise.allSettled
    // This makes 1 API call per file simultaneously instead of sequentially
    // Much faster than waiting for each check one by one
    
    const checks = [
      // CI/CD platforms
      { path: '.github/workflows', type: 'cicd', name: 'GitHub Actions', urlType: 'tree' },
      { path: '.gitlab-ci.yml', type: 'cicd', name: 'GitLab CI', urlType: 'blob' },
      { path: '.travis.yml', type: 'cicd', name: 'Travis CI', urlType: 'blob' },
      { path: '.circleci/config.yml', type: 'cicd', name: 'CircleCI', urlType: 'blob' },
      { path: 'Jenkinsfile', type: 'cicd', name: 'Jenkins', urlType: 'blob' },
      
      // Containers
      { path: 'Dockerfile', type: 'containers', name: 'Dockerfile', urlType: 'blob' },
      { path: 'docker-compose.yml', type: 'containers', name: 'docker-compose.yml', urlType: 'blob' },
      
      // Coverage
      { path: 'codecov.yml', type: 'coverage', name: 'Codecov', urlType: 'blob' },
      { path: '.coveragerc', type: 'coverage', name: 'Coverage.py', urlType: 'blob' },
      
      // Linting
      { path: '.eslintrc', type: 'linting', name: 'ESLint', urlType: 'blob' },
      { path: '.eslintrc.js', type: 'linting', name: 'ESLint', urlType: 'blob' },
      { path: '.pylintrc', type: 'linting', name: 'Pylint', urlType: 'blob' },
      
      // Security
      { path: '.github/dependabot.yml', type: 'security', name: 'Dependabot', urlType: 'blob' },
      { path: '.snyk', type: 'security', name: 'Snyk', urlType: 'blob' }
    ];
    
    // Execute all checks in parallel (much faster!)
    const results = await Promise.allSettled(
      checks.map(check => 
        githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${check.path}`)
          .then(() => ({ ...check, exists: true }))
          .catch(() => ({ ...check, exists: false }))
      )
    );
    
    // Process results
    const seenTypes = new Set();
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.exists) {
        const item = result.value;
        
        // Only add first of each type for linting/coverage to avoid duplicates
        if ((item.type === 'linting' || item.type === 'coverage') && seenTypes.has(item.type)) {
          return;
        }
        
        const url = `https://github.com/${owner}/${repo}/${item.urlType}/main/${item.path}`;
        
        if (item.type === 'testing') {
          tools[item.type].push({ framework: item.name, file: item.path, url });
        } else {
          tools[item.type].push({ name: item.name, path: item.path, url });
        }
        
        if (item.type === 'linting' || item.type === 'coverage') {
          seenTypes.add(item.type);
        }
      }
    });
    
    // Check testing frameworks by reading package.json/requirements.txt in parallel
    const testFileChecks = [
      { path: 'package.json', frameworks: ['jest', 'mocha', 'vitest', 'cypress'] },
      { path: 'requirements.txt', frameworks: ['pytest', 'unittest'] },
      { path: 'pom.xml', frameworks: ['junit'] },
      { path: 'Gemfile', frameworks: ['rspec', 'minitest'] }
    ];
    
    const testResults = await Promise.allSettled(
      testFileChecks.map(async (fileCheck) => {
        const content = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${fileCheck.path}`);
        if (content.content) {
          const decoded = atob(content.content);
          const foundFrameworks = [];
          for (const framework of fileCheck.frameworks) {
            if (decoded.toLowerCase().includes(framework)) {
              foundFrameworks.push({
                framework,
                file: fileCheck.path,
                url: `https://github.com/${owner}/${repo}/blob/main/${fileCheck.path}`
              });
            }
          }
          return foundFrameworks;
        }
        return [];
      })
    );
    
    // Add found test frameworks
    testResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        result.value.forEach(test => {
          if (!tools.testing.find(t => t.framework === test.framework)) {
            tools.testing.push(test);
          }
        });
      }
    });
    
  } catch (error) {
    // If detection fails entirely, return empty tools
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
  
  // SMART STRATEGY: 
  // - Fetch primary branch with more data (important)
  // - Fetch other branches in parallel where possible
  // - Use time filter to reduce data volume
  const maxOtherBranches = 10; // Increased from 5 since we're optimizing elsewhere
  const maxPagesPerBranch = 2;
  
  // Fetch primary branch first (most important, gets more data)
  const primaryBranchObj = branches.find(b => b.name === primaryBranch);
  if (primaryBranchObj) {
    console.log(`[DEBUG] Fetching commits from primary branch: ${primaryBranch}`);
    let branchPage = 1;
    while (branchPage <= 5) { // Primary gets 5 pages (500 commits max in time range)
      const params = { per_page: 100, page: branchPage, sha: primaryBranchObj.name };
      
      // CRITICAL: Add since parameter for date filtering on server side
      if (sinceDate) {
        params.since = sinceDate;
        console.log(`[DEBUG] Using since filter: ${sinceDate}`);
      }
      
      try {
        console.log(`[DEBUG] Fetching page ${branchPage} from ${primaryBranch}...`);
        const commits = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`, params);
        console.log(`[DEBUG] Got ${commits.length} commits on page ${branchPage}`);
        
        if (commits.length === 0) break;
        
        for (const commit of commits) {
          const commitDate = new Date(commit.commit.author.date);
          
          if (!commitMap.has(commit.sha)) {
            commitMap.set(commit.sha, { commit, branches: [primaryBranchObj.name] });
            branchCommitCounts.set(primaryBranchObj.name, (branchCommitCounts.get(primaryBranchObj.name) || 0) + 1);
            if (!branchLastSeen.has(primaryBranchObj.name) || commitDate > branchLastSeen.get(primaryBranchObj.name)) {
              branchLastSeen.set(primaryBranchObj.name, commitDate);
            }
          } else {
            commitMap.get(commit.sha).branches.push(primaryBranchObj.name);
          }
        }
        
        if (commits.length > 0 && !activeBranches.find(b => b.name === primaryBranchObj.name)) {
          activeBranches.push(primaryBranchObj);
        }
        
        if (commits.length < 100) break;
        branchPage++;
      } catch (error) {
        console.log(`[DEBUG] Error fetching commits: ${error.message}`);
        break;
      }
    }
    console.log(`[DEBUG] Finished fetching primary branch. Total in map: ${commitMap.size}`);
  } else {
    console.log(`[DEBUG] WARNING: Could not find primary branch object for: ${primaryBranch}`);
  }
  
  // Fetch other branches (with time filter for efficiency)
  for (const branch of branches.slice(0, maxOtherBranches)) {
    if (branch.name === primaryBranch) continue;
    
    let branchPage = 1;
    while (branchPage <= maxPagesPerBranch) {
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
      isMerge: commit.parents && commit.parents.length > 1,
      commit: commit.commit // Add full commit object for analysis
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
  
  console.log(`[DEBUG] ==========================================`);
  console.log(`[DEBUG] Repo: ${owner}/${repo}`);
  console.log(`[DEBUG] Time range: ${timeRange}, sinceDate: ${sinceDate}`);
  console.log(`[DEBUG] Total commits: ${allCommits.length}`);
  console.log(`[DEBUG] Contributors: ${contributors.size}`);
  console.log(`[DEBUG] Active branches: ${activeBranches.length}`);
  if (allCommits.length > 0) {
    console.log(`[DEBUG] First commit: ${allCommits[0].commit.message.split('\n')[0]}`);
    console.log(`[DEBUG] First commit date: ${allCommits[0].commit.author.date}`);
  } else {
    console.log(`[DEBUG] NO COMMITS FOUND!`);
    console.log(`[DEBUG] Branches available: ${branches.length}`);
    console.log(`[DEBUG] Primary branch: ${primaryBranch}`);
  }
  console.log(`[DEBUG] ==========================================`);
  
  // Generate management narrative from code changes
  const codeChanges = await analyzeRecentCodeChanges(owner, repo, allCommits, 10);
  
  // Generate branch activity report
  const branchActivity = generateBranchActivityReport(activeBranches, branchCommitCounts, primaryBranch, timeRange);
  
  // Build summary
  const timeLabel = getTimeRangeLabel(timeRange).toLowerCase();
  const commitCount = allCommits.length;
  const devCount = contributors.size;
  
  let summary = "";
  
  if (commitCount === 0) {
    summary = `No commits found in this time period (${timeLabel}).\n\nThis repository may not have had any activity during this time range, or the selected branch may not have recent commits. Try selecting a different time range or check if there are commits on other branches.`;
  } else {
    summary = `${commitCount} commits from ${devCount} ${devCount === 1 ? "developer" : "developers"} this ${timeLabel}.`;
    
    if (mergedPRsInRange.length > 0) {
      summary += ` ${mergedPRsInRange.length} PRs merged.`;
    }
    
    // Add branch activity report
    if (branchActivity) {
      summary += '\n\n' + branchActivity;
    }
    
    // Add narrative timeline
    if (codeChanges.narrative) {
      summary += '\n\n' + codeChanges.narrative;
    }
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
    console.log('[API] Starting analysis...');
    const { repoUrl, timeRange } = req.body;
    console.log(`[API] Repo: ${repoUrl}, Time: ${timeRange}`);
    
    const { owner, repo } = parseGitHubUrl(repoUrl);
    console.log(`[API] Parsed: ${owner}/${repo}`);
    
    const data = await analyzeGitHubRepo(owner, repo, timeRange);
    console.log(`[API] Analysis complete, sending response`);
    
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[API] ERROR:', error);
    console.error('[API] ERROR STACK:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'An error occurred during analysis',
      error: error.toString()
    });
  }
}
