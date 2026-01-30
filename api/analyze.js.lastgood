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

async function analyzeRecentCodeChanges(owner, repo, recentCommits, limit = 10) {
  const analysis = {
    commits: [],
    fileChanges: [],
    summary: ''
  };
  
  if (!recentCommits || recentCommits.length === 0) {
    analysis.summary = 'No recent commits to analyze.';
    return analysis;
  }
  
  try {
    const commitsToAnalyze = recentCommits.slice(0, Math.min(limit, recentCommits.length));
    
    // Fetch full commit details with file diffs in parallel
    const commitDetails = await Promise.allSettled(
      commitsToAnalyze.map(commit => 
        githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${commit.sha}`)
          .catch(() => null)
      )
    );
    
    // Analyze each commit in detail
    commitDetails.forEach((result, idx) => {
      if (result.status !== 'fulfilled' || !result.value?.files) return;
      
      const commit = result.value;
      const commitMessage = commit.commit.message.split('\n')[0];
      const author = commit.commit.author.name;
      const date = new Date(commit.commit.author.date);
      
      const commitAnalysis = {
        message: commitMessage,
        author,
        date,
        sha: commit.sha.substring(0, 7),
        url: `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
        filesChanged: commit.files.length,
        additions: commit.stats.additions,
        deletions: commit.stats.deletions,
        fileDetails: [],
        interpretation: '' // AI interpretation of what this commit is actually doing
      };
      
      // Analyze each file in the commit
      commit.files.forEach(file => {
        const filename = file.filename;
        const ext = filename.split('.').pop().toLowerCase();
        const dir = filename.split('/')[0];
        const status = file.status; // 'added', 'removed', 'modified', 'renamed'
        const additions = file.additions || 0;
        const deletions = file.deletions || 0;
        const patch = file.patch || '';
        
        commitAnalysis.fileDetails.push({
          filename,
          extension: ext,
          directory: dir,
          status,
          additions,
          deletions,
          changes: additions + deletions,
          patch
        });
      });
      
      // Generate intelligent interpretation for the MOST RECENT commit only
      if (idx === 0) {
        commitAnalysis.interpretation = interpretCodeChanges(commitAnalysis);
      }
      
      analysis.commits.push(commitAnalysis);
    });
    
    // Generate comprehensive summary
    const summaryParts = [];
    
    // Overview
    summaryParts.push(`Analyzed ${analysis.commits.length} most recent commits.`);
    
    // Calculate totals
    const totalFiles = analysis.commits.reduce((sum, c) => sum + c.filesChanged, 0);
    const totalAdditions = analysis.commits.reduce((sum, c) => sum + c.additions, 0);
    const totalDeletions = analysis.commits.reduce((sum, c) => sum + c.deletions, 0);
    
    summaryParts.push(`Total impact: ${totalFiles} files changed, +${totalAdditions}/-${totalDeletions} lines.`);
    
    // MOST RECENT COMMIT - Detailed interpretation
    if (analysis.commits.length > 0 && analysis.commits[0].interpretation) {
      summaryParts.push('\n\n**Most Recent Commit - Detailed Analysis:**');
      summaryParts.push(analysis.commits[0].interpretation);
    }
    
    // Detailed breakdown of recent work
    if (analysis.commits.length > 0) {
      summaryParts.push('\n\n**Recent Changes:**');
      
      analysis.commits.slice(0, 5).forEach((commit, idx) => {
        // Analyze what type of work this was
        const files = commit.fileDetails;
        const languages = new Map();
        const directories = new Map();
        const newFiles = files.filter(f => f.status === 'added').length;
        const deletedFiles = files.filter(f => f.status === 'removed').length;
        const modifiedFiles = files.filter(f => f.status === 'modified').length;
        
        files.forEach(f => {
          languages.set(f.extension, (languages.get(f.extension) || 0) + 1);
          directories.set(f.directory, (directories.get(f.directory) || 0) + 1);
        });
        
        const topLang = Array.from(languages.entries()).sort((a, b) => b[1] - a[1])[0];
        const topDir = Array.from(directories.entries()).sort((a, b) => b[1] - a[1])[0];
        
        const langMap = {
          js: 'JavaScript', jsx: 'React', ts: 'TypeScript', tsx: 'React/TypeScript',
          py: 'Python', java: 'Java', rb: 'Ruby', go: 'Go', rs: 'Rust',
          css: 'CSS', html: 'HTML', md: 'documentation', json: 'config'
        };
        
        let changeDesc = `\n${idx + 1}. **${commit.message}** (${commit.sha})`;
        changeDesc += `\n   Author: ${commit.author}`;
        changeDesc += `\n   Impact: ${commit.filesChanged} files, +${commit.additions}/-${commit.deletions} lines`;
        
        if (topLang) {
          const langName = langMap[topLang[0]] || topLang[0];
          changeDesc += `\n   Primary language: ${langName}`;
        }
        
        if (topDir) {
          changeDesc += `\n   Main area: ${topDir[0]}/`;
        }
        
        // Describe the type of changes
        const changeTypes = [];
        if (newFiles > 0) changeTypes.push(`${newFiles} new file${newFiles > 1 ? 's' : ''}`);
        if (modifiedFiles > 0) changeTypes.push(`${modifiedFiles} modified`);
        if (deletedFiles > 0) changeTypes.push(`${deletedFiles} deleted`);
        
        if (changeTypes.length > 0) {
          changeDesc += `\n   Changes: ${changeTypes.join(', ')}`;
        }
        
        // Identify patterns from filenames
        const hasTests = files.some(f => f.filename.match(/test|spec/i));
        const hasAPI = files.some(f => f.filename.match(/api|endpoint|route/i));
        const hasUI = files.some(f => f.filename.match(/component|view|page/i));
        const hasDB = files.some(f => f.filename.match(/model|schema|migration/i));
        const hasConfig = files.some(f => f.filename.match(/config|setup|\.env/i));
        
        const patterns = [];
        if (hasTests) patterns.push('tests');
        if (hasAPI) patterns.push('API');
        if (hasUI) patterns.push('UI');
        if (hasDB) patterns.push('database');
        if (hasConfig) patterns.push('configuration');
        
        if (patterns.length > 0) {
          changeDesc += `\n   Focus areas: ${patterns.join(', ')}`;
        }
        
        summaryParts.push(changeDesc);
      });
    }
    
    analysis.summary = summaryParts.join('\n');
    
  } catch (error) {
    console.error('Error analyzing code changes:', error);
    analysis.summary = 'Unable to analyze recent code changes.';
  }
  
  return analysis;
}

function interpretCodeChanges(commitAnalysis) {
  // Intelligent interpretation of what the code changes are actually doing
  const files = commitAnalysis.fileDetails;
  const interpretation = [];
  
  interpretation.push(`**Commit:** ${commitAnalysis.message}`);
  interpretation.push(`**Author:** ${commitAnalysis.author}`);
  interpretation.push(`**Files Changed:** ${commitAnalysis.filesChanged} files (+${commitAnalysis.additions}/-${commitAnalysis.deletions} lines)`);
  interpretation.push('');
  interpretation.push('**What This Code Is Actually Doing:**');
  interpretation.push('');
  
  // Analyze file types and patterns
  const filesByType = {
    frontend: files.filter(f => f.filename.match(/\.(jsx?|tsx?|vue|svelte)$/i)),
    backend: files.filter(f => f.filename.match(/\.(py|java|go|rb|php|rs)$/i) && !f.filename.match(/test/i)),
    api: files.filter(f => f.filename.match(/api|endpoint|route|controller/i)),
    database: files.filter(f => f.filename.match(/model|schema|migration|db/i)),
    tests: files.filter(f => f.filename.match(/test|spec/i)),
    config: files.filter(f => f.filename.match(/config|\.env|docker|package\.json|requirements\.txt/i)),
    styles: files.filter(f => f.filename.match(/\.(css|scss|sass|less)$/i)),
    docs: files.filter(f => f.filename.match(/\.(md|txt|rst)$/i) || f.filename.match(/readme|docs/i))
  };
  
  // Determine primary activity
  const newFiles = files.filter(f => f.status === 'added');
  const deletedFiles = files.filter(f => f.status === 'removed');
  const modifiedFiles = files.filter(f => f.status === 'modified');
  
  // INTERPRETATION LOGIC
  
  // 1. New feature detection
  if (newFiles.length > 3 && commitAnalysis.additions > 200) {
    interpretation.push('🎯 **Building a new feature:**');
    if (filesByType.frontend.length > 0) {
      interpretation.push(`   - Created ${filesByType.frontend.length} new UI component${filesByType.frontend.length > 1 ? 's' : ''}`);
      filesByType.frontend.slice(0, 3).forEach(f => {
        interpretation.push(`     • ${f.filename}`);
      });
    }
    if (filesByType.api.length > 0) {
      interpretation.push(`   - Added ${filesByType.api.length} new API endpoint${filesByType.api.length > 1 ? 's' : ''} or route${filesByType.api.length > 1 ? 's' : ''}`);
    }
    if (filesByType.database.length > 0) {
      interpretation.push(`   - Created database models/schemas for data persistence`);
    }
  }
  
  // 2. Refactoring detection
  else if (commitAnalysis.deletions > commitAnalysis.additions * 0.7 && modifiedFiles.length > 5) {
    interpretation.push('🔧 **Refactoring existing code:**');
    interpretation.push(`   - Restructured ${modifiedFiles.length} files`);
    interpretation.push(`   - Net reduction of ${commitAnalysis.deletions - commitAnalysis.additions} lines (code cleanup)`);
    const mainDirs = [...new Set(files.map(f => f.directory))];
    interpretation.push(`   - Affected areas: ${mainDirs.slice(0, 3).join(', ')}`);
  }
  
  // 3. Bug fix detection
  else if (commitMessage.match(/fix|bug|issue|patch/i) || (modifiedFiles.length <= 3 && commitAnalysis.additions < 100)) {
    interpretation.push('🐛 **Fixing a bug:**');
    interpretation.push(`   - Modified ${modifiedFiles.length} file${modifiedFiles.length > 1 ? 's' : ''} with targeted changes`);
    modifiedFiles.forEach(f => {
      interpretation.push(`     • ${f.filename} (+${f.additions}/-${f.deletions})`);
    });
    if (filesByType.tests.length > 0) {
      interpretation.push(`   - Added/updated tests to prevent regression`);
    }
  }
  
  // 4. API/Backend work
  else if (filesByType.backend.length > 0 || filesByType.api.length > 0) {
    interpretation.push('⚙️ **Backend/API development:**');
    if (filesByType.api.length > 0) {
      interpretation.push(`   - Working on API layer (${filesByType.api.length} files)`);
    }
    if (filesByType.database.length > 0) {
      interpretation.push(`   - Database changes: ${filesByType.database.map(f => f.filename).join(', ')}`);
    }
    if (filesByType.backend.length > 0) {
      const mainBackendFile = filesByType.backend[0];
      interpretation.push(`   - Business logic in: ${mainBackendFile.filename}`);
    }
  }
  
  // 5. Frontend/UI work
  else if (filesByType.frontend.length > 0) {
    interpretation.push('🎨 **Frontend/UI work:**');
    interpretation.push(`   - Modified ${filesByType.frontend.length} component${filesByType.frontend.length > 1 ? 's' : ''}`);
    filesByType.frontend.forEach(f => {
      interpretation.push(`     • ${f.filename}`);
    });
    if (filesByType.styles.length > 0) {
      interpretation.push(`   - Updated styling (${filesByType.styles.length} style file${filesByType.styles.length > 1 ? 's' : ''})`);
    }
  }
  
  // 6. Configuration changes
  else if (filesByType.config.length > 0) {
    interpretation.push('⚙️ **Configuration/infrastructure changes:**');
    filesByType.config.forEach(f => {
      interpretation.push(`   - ${f.filename}`);
      if (f.filename.match(/docker/i)) interpretation.push(`     (Container configuration)`);
      if (f.filename.match(/package\.json/i)) interpretation.push(`     (Dependencies updated)`);
      if (f.filename.match(/\.env/i)) interpretation.push(`     (Environment configuration)`);
    });
  }
  
  // 7. Testing
  if (filesByType.tests.length > 0) {
    interpretation.push('');
    interpretation.push(`✅ **Testing:** ${filesByType.tests.length} test file${filesByType.tests.length > 1 ? 's' : ''} ${newFiles.some(f => filesByType.tests.includes(f)) ? 'added' : 'updated'}`);
  }
  
  // 8. Documentation
  if (filesByType.docs.length > 0) {
    interpretation.push('');
    interpretation.push(`📚 **Documentation:** Updated ${filesByType.docs.map(f => f.filename).join(', ')}`);
  }
  
  // Add specific file details if small commit
  if (files.length <= 5) {
    interpretation.push('');
    interpretation.push('**Files modified:**');
    files.forEach(f => {
      const statusIcon = f.status === 'added' ? '➕' : f.status === 'removed' ? '➖' : '✏️';
      interpretation.push(`   ${statusIcon} ${f.filename} (+${f.additions}/-${f.deletions})`);
    });
  }
  
  return interpretation.join('\n');
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
    let branchPage = 1;
    while (branchPage <= 3) { // Primary gets 3 pages (300 commits)
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
  
  // Analyze actual code changes (not just commit messages) - detailed analysis
  const codeChanges = await analyzeRecentCodeChanges(owner, repo, allCommits, 10);
  
  // Build rich summary with actual code insights
  const timeLabel = getTimeRangeLabel(timeRange).toLowerCase();
  const commitCount = allCommits.length;
  const devCount = contributors.size;
  
  let summary = "";
  if (commitCount === 0) {
    summary = `No activity this ${timeLabel}.`;
  } else if (commitCount > 100) {
    summary = `Very active: ${devCount} developers pushed ${commitCount} commits this ${timeLabel}.`;
  } else if (commitCount > 50) {
    summary = `Active: ${devCount} developers made ${commitCount} commits this ${timeLabel}.`;
  } else {
    summary = `${commitCount} commits from ${devCount} ${devCount === 1 ? "developer" : "developers"} this ${timeLabel}.`;
  }
  
  if (mergedPRsInRange.length > 0) {
    summary += ` ${mergedPRsInRange.length} PRs merged.`;
  }
  
  // Add code change insights
  if (codeChanges.summary) {
    summary += ` ${codeChanges.summary}`;
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
