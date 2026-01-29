import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// GitHub API configuration
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Helper to make GitHub API requests
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

// Parse GitHub repo URL
function parseGitHubUrl(repoUrl) {
  const match = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL. Must be: https://github.com/owner/repo');
  }
  return { owner: match[1], repo: match[2] };
}

// Get time range as ISO date
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

// Analyze repository using GitHub API
async function analyzeGitHubRepo(owner, repo, timeRange) {
  console.log(`\n📊 Analyzing ${owner}/${repo} via GitHub API...`);
  
  const sinceDate = getTimeRangeDate(timeRange);
  
  // Get repository info
  const repoInfo = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}`);
  const primaryBranch = repoInfo.default_branch;
  const repoDescription = repoInfo.description || '';
  const repoLanguage = repoInfo.language || 'Unknown';
  
  // Try to get README for more context
  let readmeContent = '';
  try {
    const readme = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`);
    if (readme.content) {
      // Decode base64 README content (first 3000 chars only)
      const fullContent = Buffer.from(readme.content, 'base64').toString('utf-8');
      readmeContent = fullContent.substring(0, 3000);
    }
  } catch (error) {
    // README not found - continue without it
  }
  
  console.log(`✓ Primary branch: ${primaryBranch}`);
  
  // Get all branches
  const branches = await githubRequest(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches`, {
    per_page: 100
  });
  
  console.log(`✓ Found ${branches.length} total branches`);
  
  // We'll identify stale branches AFTER fetching commits (more efficient)
  const activeBranches = [];
  const staleBranches = [];
  const branchCommitCounts = new Map();
  const branchLastSeen = new Map(); // Track last commit date per branch
  
  // Get commits from ALL branches (not just primary)
  let allCommits = [];
  const commitMap = new Map(); // Track commits we've already seen
  let page = 1;
  const maxPages = 5;
  
  // Fetch commits from each branch
  for (const branch of branches.slice(0, 20)) { // Limit to 20 branches for performance
    console.log(`  Fetching commits from branch: ${branch.name}`);
    let branchPage = 1;
    
    while (branchPage <= 2) { // 2 pages per branch = 200 commits per branch
      const params = { 
        per_page: 100, 
        page: branchPage,
        sha: branch.name
      };
      if (sinceDate) {
        params.since = sinceDate;
      }
      
      try {
        const commits = await githubRequest(
          `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`,
          params
        );
        
        if (commits.length === 0) break;
        
        // Add commits we haven't seen before
        for (const commit of commits) {
          if (!commitMap.has(commit.sha)) {
            commitMap.set(commit.sha, { commit, branches: [branch.name] });
            // Track that this branch has commits in the time range
            branchCommitCounts.set(branch.name, (branchCommitCounts.get(branch.name) || 0) + 1);
            
            // Track the latest commit date for this branch
            const commitDate = new Date(commit.commit.author.date);
            if (!branchLastSeen.has(branch.name) || commitDate > branchLastSeen.get(branch.name)) {
              branchLastSeen.set(branch.name, commitDate);
            }
          } else {
            // Commit exists in multiple branches
            commitMap.get(commit.sha).branches.push(branch.name);
          }
        }
        
        // Mark branch as active if it has commits in this time range
        if (commits.length > 0 && !activeBranches.find(b => b.name === branch.name)) {
          activeBranches.push(branch);
        }
        
        if (commits.length < 100) break;
        branchPage++;
      } catch (error) {
        console.log(`  ⚠️  Could not fetch commits from ${branch.name}: ${error.message}`);
        break;
      }
    }
  }
  
  // Convert map to array
  allCommits = Array.from(commitMap.values()).map(item => ({
    ...item.commit,
    branches: item.branches
  }));
  
  // Sort by date (newest first)
  allCommits.sort((a, b) => {
    const dateA = new Date(a.commit.author.date);
    const dateB = new Date(b.commit.author.date);
    return dateB - dateA;
  });
  
  // Now determine stale branches based on commit activity we already fetched
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 90);
  
  for (const branch of branches) {
    const lastSeen = branchLastSeen.get(branch.name);
    const isActive = activeBranches.find(b => b.name === branch.name);
    
    // If we haven't seen this branch in commits OR last seen > 90 days ago
    if (!isActive || (lastSeen && lastSeen < staleThreshold)) {
      const daysSince = lastSeen 
        ? Math.floor((new Date() - lastSeen) / (1000 * 60 * 60 * 24))
        : 999; // Unknown, assume very old
        
      staleBranches.push({
        ...branch,
        lastCommit: lastSeen ? lastSeen.toISOString() : 'Unknown',
        daysSinceLastCommit: daysSince
      });
    }
  }
  
  console.log(`✓ Total commits: ${allCommits.length}`);
  
  // Get pull requests for workflow detection
  const pullRequests = await githubRequest(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`,
    { state: 'closed', per_page: 100 }
  );
  
  const mergedPRs = pullRequests.filter(pr => pr.merged_at);
  console.log(`✓ Found ${mergedPRs.length} merged PRs`);
  
  // Process contributors and graph
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
    const commitBranches = commit.branches || [primaryBranch];
    
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
      branches: commitBranches,
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
  
  console.log(`✅ Analysis complete! ${activeBranches.length} active branches, ${staleBranches.length} stale branches.\n`);
  
  // Branch analysis - use active branches only
  const branchingAnalysis = analyzeBranchingPatterns(
    activeBranches,
    graphNodes,
    mergedPRs,
    primaryBranch
  );
  
  // Format active branches only
  const formattedBranches = activeBranches.map(branch => ({
    name: branch.name,
    isPrimary: branch.name === primaryBranch,
    commitCount: branchCommitCounts.get(branch.name) || 0,
    isStale: false
  }));
  
  // Format stale branches
  const formattedStaleBranches = staleBranches.map(branch => ({
    name: branch.name,
    isPrimary: branch.name === primaryBranch,
    lastCommit: branch.lastCommit,
    daysSinceLastCommit: branch.daysSinceLastCommit,
    isStale: true
  }));
  
  // Generate activity summary
  const topContributors = Array.from(contributors.values())
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 5);
  
  const commitMessages = graphNodes.map(node => node.subject);
  
  const summary = generateActivitySummary({
    timeRange: getTimeRangeLabel(timeRange),
    totalCommits: allCommits.length,
    contributorCount: contributors.size,
    topContributors,
    commitMessages,
    activeBranches: activeBranches.length,
    staleBranches: staleBranches.length,
    mergeCount: merges.length,
    branchingStrategy: branchingAnalysis.strategy,
    workflow: branchingAnalysis.workflow,
    repoDescription,
    repoLanguage,
    readmeContent,
    repoName: `${owner}/${repo}`
  });
  
  return {
    contributors: Array.from(contributors.values()).sort((a, b) => b.commits - a.commits),
    totalCommits: allCommits.length,
    timeRange: getTimeRangeLabel(timeRange),
    primaryBranch: primaryBranch,
    totalBranches: activeBranches.length,
    staleBranchesCount: staleBranches.length,
    allBranchesCount: branches.length,
    merges: merges,
    branches: formattedBranches,
    staleBranches: formattedStaleBranches,
    timeline: timeline,
    graph: graphNodes,
    branchingAnalysis: branchingAnalysis,
    activitySummary: summary
  };
}

function generateRepoSummary(data) {
  // Generate 2-3 sentence description of what the repo does
  const { repoDescription, repoLanguage, readmeContent, repoName, commitMessages } = data;
  
  // Start with repo description if available
  if (repoDescription && repoDescription.length > 10) {
    return `${repoName} is ${repoDescription.charAt(0).toLowerCase() + repoDescription.slice(1)}`;
  }
  
  // Extract from README if available
  if (readmeContent) {
    // Look for common README patterns
    const lines = readmeContent.split('\n').filter(line => line.trim().length > 20);
    
    // Find first substantial paragraph after title
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i].trim();
      // Skip markdown headers, badges, images
      if (line.startsWith('#') || line.startsWith('!') || line.startsWith('[!')) continue;
      if (line.length > 50 && line.length < 300) {
        // Clean up markdown
        const cleaned = line
          .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
          .replace(/[*_`]/g, '') // Remove formatting
          .replace(/\s+/g, ' ')
          .trim();
        if (cleaned.length > 30) {
          return `${repoName}: ${cleaned}`;
        }
      }
    }
  }
  
  // Fallback: infer from language and commit patterns
  if (repoLanguage && repoLanguage !== 'Unknown') {
    const commitKeywords = commitMessages ? commitMessages.slice(0, 50).join(' ').toLowerCase() : '';
    let purpose = '';
    
    if (commitKeywords.includes('api') || commitKeywords.includes('server') || commitKeywords.includes('backend')) {
      purpose = `a ${repoLanguage} backend service`;
    } else if (commitKeywords.includes('frontend') || commitKeywords.includes('ui') || commitKeywords.includes('component')) {
      purpose = `a ${repoLanguage} frontend application`;
    } else if (commitKeywords.includes('library') || commitKeywords.includes('package')) {
      purpose = `a ${repoLanguage} library`;
    } else if (commitKeywords.includes('cli') || commitKeywords.includes('command')) {
      purpose = `a ${repoLanguage} command-line tool`;
    } else {
      purpose = `a ${repoLanguage} project`;
    }
    
    return `${repoName} is ${purpose}.`;
  }
  
  return null; // No description available
}

function generateActivitySummary(data) {
  const parts = [];
  
  // Repo purpose/description (from README or repo description)
  const repoSummary = generateRepoSummary(data);
  if (repoSummary) {
    parts.push(repoSummary);
  }
  
  // Opening
  parts.push(`Over ${data.timeRange.toLowerCase()}, this repository had ${data.totalCommits} commits from ${data.contributorCount} ${data.contributorCount === 1 ? 'contributor' : 'contributors'}.`);
  
  // Top contributors
  if (data.topContributors.length > 0) {
    const topNames = data.topContributors.slice(0, 3).map(c => `${c.name} (${c.commits})`).join(', ');
    parts.push(`Most active contributors: ${topNames}.`);
  }
  
  // Detailed change analysis
  if (data.commitMessages && data.commitMessages.length > 0) {
    const changeAnalysis = analyzeChanges(data.commitMessages);
    
    // Primary work areas
    if (changeAnalysis.keywords.length > 0) {
      parts.push(`Primary work areas: ${changeAnalysis.keywords.slice(0, 5).join(', ')}.`);
    }
    
    // Change types with impact
    const changeTypes = [];
    if (changeAnalysis.features > 0) {
      changeTypes.push(`${changeAnalysis.features} new features added`);
    }
    if (changeAnalysis.bugfixes > 0) {
      changeTypes.push(`${changeAnalysis.bugfixes} bugs fixed`);
    }
    if (changeAnalysis.improvements > 0) {
      changeTypes.push(`${changeAnalysis.improvements} improvements made`);
    }
    if (changeAnalysis.refactors > 0) {
      changeTypes.push(`${changeAnalysis.refactors} refactorings`);
    }
    if (changeAnalysis.tests > 0) {
      changeTypes.push(`${changeAnalysis.tests} test updates`);
    }
    if (changeAnalysis.docs > 0) {
      changeTypes.push(`${changeAnalysis.docs} documentation updates`);
    }
    
    if (changeTypes.length > 0) {
      parts.push(`Changes include: ${changeTypes.join(', ')}.`);
    }
    
    // Impact assessment
    const impacts = [];
    if (changeAnalysis.performance > 0) {
      impacts.push(`performance optimizations (${changeAnalysis.performance})`);
    }
    if (changeAnalysis.security > 0) {
      impacts.push(`security enhancements (${changeAnalysis.security})`);
    }
    if (changeAnalysis.breaking > 0) {
      impacts.push(`⚠️ breaking changes (${changeAnalysis.breaking})`);
    }
    if (changeAnalysis.deprecations > 0) {
      impacts.push(`deprecations (${changeAnalysis.deprecations})`);
    }
    
    if (impacts.length > 0) {
      parts.push(`Notable impacts: ${impacts.join(', ')}.`);
    }
    
    // Quality indicators
    if (changeAnalysis.tests > data.totalCommits * 0.2) {
      parts.push(`Strong testing focus with ${Math.round((changeAnalysis.tests / data.totalCommits) * 100)}% of commits including tests.`);
    }
    if (changeAnalysis.bugfixes > data.totalCommits * 0.3) {
      parts.push(`High bug-fixing activity suggests stabilization phase.`);
    }
    if (changeAnalysis.features > data.totalCommits * 0.3) {
      parts.push(`Heavy feature development indicates active growth phase.`);
    }
  }
  
  // Branch activity
  if (data.activeBranches > 1) {
    parts.push(`Development occurred across ${data.activeBranches} active branches.`);
  }
  
  // Stale branches warning
  if (data.staleBranches > 0) {
    parts.push(`⚠️ ${data.staleBranches} stale ${data.staleBranches === 1 ? 'branch' : 'branches'} detected (no activity in 90+ days) - consider cleanup.`);
  }
  
  // Merges
  if (data.mergeCount > 0) {
    parts.push(`${data.mergeCount} merge commits indicate active collaboration.`);
  }
  
  // Strategy
  parts.push(`The team is using ${data.branchingStrategy} with a ${data.workflow} workflow.`);
  
  return parts.join(' ');
}

function analyzeChanges(commitMessages) {
  const analysis = {
    keywords: [],
    features: 0,
    bugfixes: 0,
    improvements: 0,
    refactors: 0,
    tests: 0,
    docs: 0,
    performance: 0,
    security: 0,
    breaking: 0,
    deprecations: 0
  };
  
  const stopWords = new Set([
    'add', 'added', 'adds', 'update', 'updated', 'updates', 'fix', 'fixed', 'fixes',
    'remove', 'removed', 'removes', 'change', 'changed', 'changes', 'improve', 'improved',
    'refactor', 'refactored', 'merge', 'merged', 'branch', 'commit', 'the', 'a', 'an',
    'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by',
    'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can',
    'this', 'that', 'these', 'those', 'some', 'all', 'any', 'more', 'most', 'other',
    'make', 'made', 'use', 'used', 'get', 'set', 'new', 'old', 'first', 'last'
  ]);
  
  const wordFrequency = new Map();
  
  commitMessages.forEach(msg => {
    const lower = msg.toLowerCase();
    
    // Count change types
    if (/\b(feat|feature|add|new|implement|introduce)\b/i.test(msg)) {
      analysis.features++;
    }
    if (/\b(fix|bug|issue|resolve|patch)\b/i.test(msg)) {
      analysis.bugfixes++;
    }
    if (/\b(improve|enhance|better|optimize|upgrade)\b/i.test(msg)) {
      analysis.improvements++;
    }
    if (/\b(refactor|restructure|reorganize|cleanup|clean up)\b/i.test(msg)) {
      analysis.refactors++;
    }
    if (/\b(test|spec|jest|mocha|unit|integration)\b/i.test(msg)) {
      analysis.tests++;
    }
    if (/\b(doc|docs|documentation|readme|comment)\b/i.test(msg)) {
      analysis.docs++;
    }
    if (/\b(performance|perf|speed|faster|optimize|slow)\b/i.test(msg)) {
      analysis.performance++;
    }
    if (/\b(security|vulnerability|cve|xss|sql injection|auth)\b/i.test(msg)) {
      analysis.security++;
    }
    if (/\b(breaking|break|deprecated|deprecate)\b/i.test(msg)) {
      if (/\bbreak/i.test(msg)) analysis.breaking++;
      if (/\bdeprecate/i.test(msg)) analysis.deprecations++;
    }
    
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

function analyzeBranchingPatterns(branches, graphNodes, mergedPRs, primaryBranch) {
  const analysis = {
    patterns: [],
    strategy: 'Unknown',
    strategyExplanation: '',
    insights: [],
    workflow: 'Unknown',
    workflowExplanation: '',
    detectionCriteria: [],
    branchCounts: {} // Add detailed counts
  };
  
  // Count branch types
  const featureBranches = branches.filter(b => b.name.includes('feature'));
  const bugfixBranches = branches.filter(b => b.name.includes('fix'));
  const developBranches = branches.filter(b => b.name.includes('develop') || b.name.includes('dev'));
  const hotfixBranches = branches.filter(b => b.name.includes('hotfix'));
  const releaseBranches = branches.filter(b => b.name.includes('release'));
  
  // Store counts
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
  
  // Use counts from analysis object
  const { feature, bugfix, develop, hotfix, release, total } = analysis.branchCounts;
  
  // Detect workflow
  if (prCount > 10 || prRatio > 10) {
    analysis.workflow = 'Fork + Pull Request';
    analysis.workflowExplanation = 'Contributors fork the repository and submit pull requests. This is the standard GitHub open source workflow.';
    analysis.detectionCriteria = [
      `✓ ${prCount} merged pull requests detected`,
      `✓ ${prRatio}% PR merge ratio`,
      `✓ Using GitHub's fork & PR model`,
      `Pattern: Fork → Make changes → Submit PR → Review → Merge`
    ];
    analysis.insights.push(`${prCount} merged pull requests found`);
    analysis.insights.push('Standard GitHub fork workflow');
  } else if (branches.length <= 3) {
    analysis.workflow = 'Trunk-Based Development';
    analysis.workflowExplanation = 'Few branches with most work happening on main branch.';
    analysis.detectionCriteria = [
      `✓ Only ${branches.length} branches`,
      `✓ ${mergeRatio}% merge commits`,
      `Pattern: Direct commits to main with minimal branching`
    ];
    analysis.insights.push('Minimal branching detected');
  } else {
    analysis.workflow = 'Branch-based Development';
    analysis.workflowExplanation = 'Multiple branches with feature branch workflow.';
    analysis.detectionCriteria = [
      `✓ ${branches.length} active branches`,
      `✓ ${mergeRatio}% merge commits`,
      `Pattern: Feature branches merged to main`
    ];
  }
  
  // Detect strategy
  if (develop > 0 && (feature > 0 || release > 0)) {
    analysis.strategy = 'Git Flow';
    analysis.strategyExplanation = 'A structured branching model with main/master for production, develop for integration, and feature/release/hotfix branches. Best for scheduled release cycles.';
  } else if (feature > 3) {
    analysis.strategy = 'GitHub Flow';
    analysis.strategyExplanation = 'Simple workflow with main/master as production-ready and feature branches for development. Deploy from main after every merge. Best for continuous deployment.';
  } else if (total <= 3) {
    analysis.strategy = 'Trunk-Based Development';
    analysis.strategyExplanation = 'Developers work on main/trunk with minimal branching. Short-lived feature branches (if any) merge quickly. Requires strong CI/CD and feature flags.';
  } else {
    analysis.strategy = 'Custom Strategy';
    analysis.strategyExplanation = 'This repository uses a unique branching pattern that doesn\'t match standard workflows.';
  }
  
  // Add patterns
  if (feature > 0) {
    analysis.patterns.push({ type: 'Feature Branches', count: feature });
  }
  if (bugfix > 0) {
    analysis.patterns.push({ type: 'Bugfix Branches', count: bugfix });
  }
  if (hotfix > 0) {
    analysis.patterns.push({ type: 'Hotfix Branches', count: hotfix });
  }
  if (develop > 0) {
    analysis.patterns.push({ type: 'Development Branches', count: develop });
  }
  if (release > 0) {
    analysis.patterns.push({ type: 'Release Branches', count: release });
  }
  
  analysis.insights.push(`${mergeRatio}% of commits are merges`);
  analysis.insights.push(`${total} total branches`);
  
  return analysis;
}

// API endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { repoUrl, timeRange } = req.body;
    
    console.log(`📥 Request: ${repoUrl} (${timeRange})`);
    
    // Parse GitHub URL
    const { owner, repo } = parseGitHubUrl(repoUrl);
    
    // Analyze using GitHub API
    const data = await analyzeGitHubRepo(owner, repo, timeRange);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      hint: 'Make sure the URL is a public GitHub repository. For private repos, set GITHUB_TOKEN environment variable.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 GitHub API-based Git Analyzer                         ║
║  📡 Running on http://localhost:${PORT}                      ║
║                                                           ║
║  ✨ No git cloning required!                              ║
║  💾 No storage costs                                       ║
║  ⚡ Much faster analysis                                   ║
║  📊 Rate limit: ${GITHUB_TOKEN ? '5,000' : '60'} requests/hour ${!GITHUB_TOKEN ? '(unauthenticated)' : ''}         ║
║                                                           ║
║  💡 Set GITHUB_TOKEN env variable to increase rate limit  ║
╚═══════════════════════════════════════════════════════════╝
`);
});
