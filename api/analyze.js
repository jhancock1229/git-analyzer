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
  if (!recentCommits || recentCommits.length === 0) {
    return { narrative: 'No recent activity to report.' };
  }
  
  try {
    // Take only the 10 most recent commits for deep analysis
    const commitsToAnalyze = recentCommits.slice(0, Math.min(limit, recentCommits.length));
    
    console.log(`[NARRATIVE] Analyzing ${commitsToAnalyze.length} recent commits with code diffs`);
    
    // Fetch full commit details INCLUDING patches (code diffs)
    const commitDetails = await Promise.allSettled(
      commitsToAnalyze.map(commit => 
        githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${commit.sha}`)
          .catch(() => null)
      )
    );
    
    // Process commits with their code changes
    const commitsWithDiffs = [];
    commitDetails.forEach((result) => {
      if (result.status !== 'fulfilled' || !result.value?.files) return;
      
      const commit = result.value;
      commitsWithDiffs.push({
        message: commit.commit.message.split('\n')[0],
        fullMessage: commit.commit.message,
        author: commit.commit.author.name,
        date: new Date(commit.commit.author.date),
        sha: commit.sha.substring(0, 7),
        url: commit.html_url,
        files: commit.files.map(f => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions || 0,
          deletions: f.deletions || 0,
          patch: f.patch || '' // The actual code diff!
        }))
      });
    });
    
    console.log(`[NARRATIVE] Successfully fetched ${commitsWithDiffs.length} commits with diffs`);
    
    // Generate narrative by reading the actual code
    const narrative = writeCodeNarrative(commitsWithDiffs, owner, repo);
    
    return { narrative };
    
  } catch (error) {
    console.error('Error analyzing commits:', error);
    return { narrative: 'Unable to generate development narrative.' };
  }
}

function writeCodeNarrative(commits, owner, repo) {
  if (commits.length === 0) return 'No recent development activity.';
  
  const story = [];
  
  // Header
  story.push(`# What the Team Has Been Building`);
  story.push(`*Based on the last ${commits.length} commits*`);
  story.push('');
  
  // Date range
  const newest = commits[0].date;
  const oldest = commits[commits.length - 1].date;
  const days = Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24));
  
  story.push(`**Time Period:** ${formatDate(oldest)} to ${formatDate(newest)} (${days} day${days !== 1 ? 's' : ''})`);
  story.push('');
  story.push('---');
  story.push('');
  
  // Analyze the code changes and write a narrative
  story.push('## What the Code Is Doing');
  story.push('');
  
  // Group related changes
  const workAreas = analyzeWorkAreas(commits);
  
  // Write narrative for each area of work
  for (const [area, details] of Object.entries(workAreas)) {
    if (details.commits.length === 0) continue;
    
    story.push(`### ${area}`);
    story.push('');
    story.push(details.narrative);
    story.push('');
    
    if (details.technicalDetails.length > 0) {
      story.push('**Technical changes:**');
      details.technicalDetails.forEach(detail => {
        story.push(`- ${detail}`);
      });
      story.push('');
    }
  }
  
  // Recent commit timeline
  story.push('---');
  story.push('');
  story.push('## Recent Commit Timeline');
  story.push('');
  
  commits.slice(0, 5).forEach((commit, idx) => {
    story.push(`**${idx + 1}. ${commit.message}**`);
    story.push(`*${formatDate(commit.date)} by ${commit.author}*`);
    story.push('');
    
    // Write what this commit actually does
    const explanation = explainCommit(commit);
    story.push(explanation);
    story.push('');
  });
  
  return story.join('\n');
}

function analyzeWorkAreas(commits) {
  const areas = {
    'User Interface': {
      commits: [],
      files: [],
      patches: [],
      narrative: '',
      technicalDetails: []
    },
    'Backend Services': {
      commits: [],
      files: [],
      patches: [],
      narrative: '',
      technicalDetails: []
    },
    'Database & Data': {
      commits: [],
      files: [],
      patches: [],
      narrative: '',
      technicalDetails: []
    },
    'Infrastructure & Configuration': {
      commits: [],
      files: [],
      patches: [],
      narrative: '',
      technicalDetails: []
    },
    'Testing & Quality': {
      commits: [],
      files: [],
      patches: [],
      narrative: '',
      technicalDetails: []
    }
  };
  
  // Categorize commits
  commits.forEach(commit => {
    commit.files.forEach(file => {
      const f = file.filename.toLowerCase();
      
      // UI/Frontend
      if (f.match(/component|view|page|\.jsx|\.tsx|\.vue|\.css|\.scss/)) {
        areas['User Interface'].commits.push(commit);
        areas['User Interface'].files.push(file);
        areas['User Interface'].patches.push(file.patch);
      }
      // Backend
      else if (f.match(/api|endpoint|route|controller|service|\.py|\.java|\.go|\.rb/)) {
        areas['Backend Services'].commits.push(commit);
        areas['Backend Services'].files.push(file);
        areas['Backend Services'].patches.push(file.patch);
      }
      // Database
      else if (f.match(/model|schema|migration|database|db/)) {
        areas['Database & Data'].commits.push(commit);
        areas['Database & Data'].files.push(file);
        areas['Database & Data'].patches.push(file.patch);
      }
      // Infrastructure
      else if (f.match(/docker|\.yml|\.yaml|config|deploy|ci|cd/)) {
        areas['Infrastructure & Configuration'].commits.push(commit);
        areas['Infrastructure & Configuration'].files.push(file);
        areas['Infrastructure & Configuration'].patches.push(file.patch);
      }
      // Testing
      else if (f.match(/test|spec|\.test\.|\.spec\./)) {
        areas['Testing & Quality'].commits.push(commit);
        areas['Testing & Quality'].files.push(file);
        areas['Testing & Quality'].patches.push(file.patch);
      }
    });
  });
  
  // Generate narratives for each area by reading the code
  for (const [areaName, area] of Object.entries(areas)) {
    if (area.commits.length === 0) continue;
    
    area.narrative = generateAreaNarrative(areaName, area);
    area.technicalDetails = extractTechnicalDetails(area);
  }
  
  return areas;
}

function generateAreaNarrative(areaName, area) {
  const uniqueCommits = [...new Set(area.commits.map(c => c.sha))];
  const fileCount = area.files.length;
  
  let narrative = '';
  
  // Analyze what the code is doing based on patches
  const codePatterns = analyzeCodePatterns(area.patches, area.files);
  
  if (areaName === 'User Interface') {
    narrative = `The team has been updating the user interface. `;
    
    if (codePatterns.newComponents) {
      narrative += `They've created new interface components that ${codePatterns.purpose || 'enhance the user experience'}. `;
    }
    if (codePatterns.apiCalls) {
      narrative += `These components connect to backend services to fetch and display data. `;
    }
    if (codePatterns.stateManagement) {
      narrative += `The code manages user interactions and keeps the interface responsive. `;
    }
    if (codePatterns.styling) {
      narrative += `Visual styling has been updated to improve the look and feel. `;
    }
  }
  else if (areaName === 'Backend Services') {
    narrative = `The backend infrastructure is being enhanced. `;
    
    if (codePatterns.newEndpoints) {
      narrative += `New API endpoints have been added to handle ${codePatterns.purpose || 'additional functionality'}. `;
    }
    if (codePatterns.dataProcessing) {
      narrative += `The code processes incoming requests, validates data, and performs business logic. `;
    }
    if (codePatterns.authentication) {
      narrative += `Security measures including authentication and authorization are being implemented. `;
    }
    if (codePatterns.database) {
      narrative += `These services interact with the database to store and retrieve information. `;
    }
  }
  else if (areaName === 'Database & Data') {
    narrative = `Data structures are being modified. `;
    
    if (codePatterns.newTables) {
      narrative += `New database tables or collections are being created to store ${codePatterns.purpose || 'application data'}. `;
    }
    if (codePatterns.migrations) {
      narrative += `Database migrations ensure existing data is preserved while the structure evolves. `;
    }
    if (codePatterns.relationships) {
      narrative += `Relationships between different data entities are being established. `;
    }
  }
  else if (areaName === 'Infrastructure & Configuration') {
    narrative = `The deployment and infrastructure setup is being refined. `;
    
    if (codePatterns.docker) {
      narrative += `Container configurations ensure the application runs consistently across different environments. `;
    }
    if (codePatterns.cicd) {
      narrative += `Automated testing and deployment pipelines are being configured. `;
    }
    if (codePatterns.config) {
      narrative += `Environment settings and configuration files are being updated. `;
    }
  }
  else if (areaName === 'Testing & Quality') {
    narrative = `Quality assurance is being strengthened. `;
    
    if (codePatterns.unitTests) {
      narrative += `New tests verify that individual components work correctly. `;
    }
    if (codePatterns.integrationTests) {
      narrative += `Integration tests ensure different parts of the system work together properly. `;
    }
    if (codePatterns.coverage) {
      narrative += `Test coverage is being expanded to catch potential issues early. `;
    }
  }
  
  narrative += `(${uniqueCommits.length} commit${uniqueCommits.length !== 1 ? 's' : ''}, ${fileCount} file${fileCount !== 1 ? 's' : ''} changed)`;
  
  return narrative;
}

function analyzeCodePatterns(patches, files) {
  const patterns = {
    newComponents: false,
    apiCalls: false,
    stateManagement: false,
    styling: false,
    newEndpoints: false,
    dataProcessing: false,
    authentication: false,
    database: false,
    newTables: false,
    migrations: false,
    relationships: false,
    docker: false,
    cicd: false,
    config: false,
    unitTests: false,
    integrationTests: false,
    coverage: false,
    purpose: ''
  };
  
  const allPatches = patches.join('\n').toLowerCase();
  
  // Detect patterns in the code
  if (allPatches.match(/function.*component|class.*component|export.*component/i)) patterns.newComponents = true;
  if (allPatches.match(/fetch|axios|api\.|endpoint/)) patterns.apiCalls = true;
  if (allPatches.match(/usestate|useeffect|setstate|redux|context/)) patterns.stateManagement = true;
  if (allPatches.match(/style|css|className|styled/)) patterns.styling = true;
  
  if (allPatches.match(/@app\.|@post|@get|@put|@delete|router\.|route\(/)) patterns.newEndpoints = true;
  if (allPatches.match(/validate|sanitize|process|parse|transform/)) patterns.dataProcessing = true;
  if (allPatches.match(/auth|jwt|token|session|password|login/)) patterns.authentication = true;
  if (allPatches.match(/query|insert|update|delete|select|findone/)) patterns.database = true;
  
  if (allPatches.match(/create.*table|db\.create|collection\./)) patterns.newTables = true;
  if (allPatches.match(/migration|migrate|alter.*table/)) patterns.migrations = true;
  if (allPatches.match(/foreign.*key|references|belongsto|hasmany/)) patterns.relationships = true;
  
  if (files.some(f => f.filename.match(/dockerfile/i))) patterns.docker = true;
  if (files.some(f => f.filename.match(/\.github\/workflows|\.yml/))) patterns.cicd = true;
  if (files.some(f => f.filename.match(/config|\.env/))) patterns.config = true;
  
  if (allPatches.match(/test\(|it\(|describe\(/)) patterns.unitTests = true;
  if (allPatches.match(/request\(|supertest|integration/)) patterns.integrationTests = true;
  
  return patterns;
}

function extractTechnicalDetails(area) {
  const details = [];
  const filenames = area.files.map(f => f.filename);
  
  // Group by directory
  const dirs = new Map();
  filenames.forEach(f => {
    const parts = f.split('/');
    if (parts.length > 1) {
      const dir = parts[0];
      dirs.set(dir, (dirs.get(dir) || 0) + 1);
    }
  });
  
  // Most active directories
  const topDirs = Array.from(dirs.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  if (topDirs.length > 0) {
    details.push(`Modified ${topDirs.map(([dir, count]) => `${dir}/ (${count} files)`).join(', ')}`);
  }
  
  // File operations
  const added = area.files.filter(f => f.status === 'added').length;
  const modified = area.files.filter(f => f.status === 'modified').length;
  const removed = area.files.filter(f => f.status === 'removed').length;
  
  const ops = [];
  if (added > 0) ops.push(`${added} new`);
  if (modified > 0) ops.push(`${modified} modified`);
  if (removed > 0) ops.push(`${removed} removed`);
  
  if (ops.length > 0) {
    details.push(`Files: ${ops.join(', ')}`);
  }
  
  return details;
}

function explainCommit(commit) {
  const explanation = [];
  
  // Count file types
  const fileTypes = {
    ui: commit.files.filter(f => f.filename.match(/\.(jsx|tsx|vue|css|scss)$/i)),
    backend: commit.files.filter(f => f.filename.match(/\.(py|java|go|rb|js|ts)$/i) && !f.filename.match(/test/i)),
    db: commit.files.filter(f => f.filename.match(/model|schema|migration/i)),
    test: commit.files.filter(f => f.filename.match(/test|spec/i)),
    config: commit.files.filter(f => f.filename.match(/config|docker|\.yml/i))
  };
  
  if (fileTypes.ui.length > 0) {
    explanation.push(`Updated ${fileTypes.ui.length} interface file${fileTypes.ui.length > 1 ? 's' : ''}.`);
  }
  if (fileTypes.backend.length > 0) {
    explanation.push(`Modified ${fileTypes.backend.length} backend file${fileTypes.backend.length > 1 ? 's' : ''}.`);
  }
  if (fileTypes.db.length > 0) {
    explanation.push(`Changed database structure (${fileTypes.db.length} file${fileTypes.db.length > 1 ? 's' : ''}).`);
  }
  if (fileTypes.test.length > 0) {
    explanation.push(`Added/updated tests (${fileTypes.test.length} file${fileTypes.test.length > 1 ? 's' : ''}).`);
  }
  if (fileTypes.config.length > 0) {
    explanation.push(`Updated configuration.`);
  }
  
  if (explanation.length === 0) {
    explanation.push(`Modified ${commit.files.length} file${commit.files.length > 1 ? 's' : ''}.`);
  }
  
  return explanation.join(' ');
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
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
    while (branchPage <= 5) { // Primary gets 5 pages (500 commits max in time range)
      const params = { per_page: 100, page: branchPage, sha: primaryBranchObj.name };
      
      // CRITICAL: Add since parameter for date filtering on server side
      if (sinceDate) {
        params.since = sinceDate;
      }
      
      try {
        const commits = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`, params);
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
  
  console.log(`[DEBUG] Time range: ${timeRange}, sinceDate: ${sinceDate}`);
  console.log(`[DEBUG] Total commits fetched: ${allCommits.length}`);
  console.log(`[DEBUG] First commit date: ${allCommits[0]?.commit?.author?.date}`);
  
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
  
  // Generate management narrative from code changes
  const codeChanges = await analyzeRecentCodeChanges(owner, repo, allCommits, 10);
  
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
    const { repoUrl, timeRange } = req.body;
    const { owner, repo } = parseGitHubUrl(repoUrl);
    const data = await analyzeGitHubRepo(owner, repo, timeRange);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
