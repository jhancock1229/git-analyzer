const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const REPOS_DIR = path.join(__dirname, 'repos');
const TIME_RANGES = {
  'day': { days: 1, label: 'Last 24 Hours' },
  'week': { days: 7, label: 'Last Week' },
  'month': { days: 30, label: 'Last Month' },
  'quarter': { days: 90, label: 'Last Quarter' },
  '6months': { days: 180, label: 'Last 6 Months' },
  'year': { days: 365, label: 'Last Year' },
  'all': { days: null, label: 'All Time' }
};

// Ensure repos directory exists
async function ensureReposDir() {
  try {
    await fs.mkdir(REPOS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating repos directory:', error);
  }
}

// Clone or update repository
async function cloneOrUpdateRepo(repoUrl) {
  const repoName = repoUrl.split('/').pop().replace('.git', '');
  const repoPath = path.join(REPOS_DIR, repoName);

  try {
    // Check if repo already exists
    await fs.access(repoPath);
    console.log(`Updating existing repository: ${repoName}`);
    
    // Update existing repo
    await execAsync('git fetch --all && git pull', { cwd: repoPath });
    return repoPath;
  } catch {
    // Clone new repo
    console.log(`Cloning new repository: ${repoName}`);
    await execAsync(`git clone ${repoUrl} ${repoPath}`);
    return repoPath;
  }
}

// Get git log data for a specific time range
async function getGitData(repoPath, timeRange) {
  const sinceDate = timeRange === 'all' 
    ? '' 
    : `--since="${TIME_RANGES[timeRange].days} days ago"`;

  try {
    // Fetch all remote branches
    await execAsync('git fetch --all', { cwd: repoPath });
    
    // Get primary branch name (main, master, etc.)
    let primaryBranch = 'main';
    try {
      const { stdout: headBranch } = await execAsync(
        `git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`,
        { cwd: repoPath }
      );
      primaryBranch = headBranch.trim();
    } catch {
      // Fallback: check if main or master exists
      try {
        await execAsync(`git rev-parse --verify origin/main`, { cwd: repoPath });
        primaryBranch = 'main';
      } catch {
        try {
          await execAsync(`git rev-parse --verify origin/master`, { cwd: repoPath });
          primaryBranch = 'master';
        } catch {
          // Use the first branch found
          const { stdout: firstBranch } = await execAsync(
            `git branch -r --format='%(refname:short)' | grep -v HEAD | head -1 | sed 's@origin/@@'`,
            { cwd: repoPath }
          );
          primaryBranch = firstBranch.trim();
        }
      }
    }

    // Get all remote branches with their info
    const { stdout: branchData } = await execAsync(
      `git for-each-ref --format='%(refname:short)|%(authorname)|%(authoremail)|%(committerdate:iso)|%(creatordate:iso)|%(committername)' refs/remotes/origin/`,
      { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
    );

    // Get commit data for the time range (without numstat for performance on huge repos)
    const { stdout: commitData } = await execAsync(
      `git log --all ${sinceDate} --pretty=format:'%H|%an|%ae|%ar|%s|%b|%ct|%P'`,
      { cwd: repoPath, maxBuffer: 100 * 1024 * 1024 }
    );

    // Get stats separately for contributors (only on primary branch to reduce data)
    const { stdout: statsData } = await execAsync(
      `git log ${primaryBranch} ${sinceDate} --pretty=format:'%H|%ae' --numstat`,
      { cwd: repoPath, maxBuffer: 100 * 1024 * 1024 }
    );

    // Get branch tips (which commit each branch points to) - from remote branches
    const { stdout: branchTips } = await execAsync(
      `git for-each-ref --format='%(refname:short)|%(objectname)' refs/remotes/origin/`,
      { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
    );

    // Get all commits with their branch information for graph (limit based on time range)
    const graphLimit = timeRange === 'all' ? '--max-count=500' : 
                       timeRange === 'year' ? '--max-count=300' :
                       timeRange === '6months' ? '--max-count=250' :
                       timeRange === 'quarter' ? '--max-count=200' :
                       '--max-count=150';
    const { stdout: graphData } = await execAsync(
      `git log --all ${sinceDate} ${graphLimit} --pretty=format:'%H|%an|%ae|%ct|%s|%P|%D' --date-order`,
      { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
    );

    // Get merge commits to primary branch
    const { stdout: mergeData } = await execAsync(
      `git log ${primaryBranch} ${sinceDate} --merges --pretty=format:'%H|%an|%ae|%ar|%s|%P'`,
      { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
    );

    // Get branch creation info (first commit on each branch) - from remote
    const { stdout: branchCreationData } = await execAsync(
      `git for-each-ref --format='%(refname:short)|%(creatordate:iso)|%(creator)' refs/remotes/origin/`,
      { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
    );

    return { branchData, commitData, statsData, mergeData, branchCreationData, primaryBranch, branchTips, graphData };
  } catch (error) {
    console.error('Error getting git data:', error);
    throw error;
  }
}

// Parse git data into structured format
function parseGitData(branchData, commitData, statsData, mergeData, branchCreationData, primaryBranch, branchTips, graphData, timeRange) {
  const contributors = new Map();
  const branches = [];
  const merges = [];

  // Parse branch tips to know which commits are branch heads
  const branchTipMap = new Map();
  const tipLines = branchTips.trim().split('\n').filter(line => line);
  for (const line of tipLines) {
    const [branchName, commitHash] = line.split('|');
    if (branchName.includes('HEAD')) continue;
    // Map both with and without origin/ prefix
    const cleanName = branchName.replace('origin/', '');
    branchTipMap.set(commitHash, cleanName);
  }

  // Parse graph data for visualization
  const graphNodes = [];
  const graphLines = graphData.trim().split('\n').filter(line => line);
  
  console.log(`Parsing ${graphLines.length} graph lines`);
  
  for (const line of graphLines) {
    const [hash, author, email, timestamp, subject, parents, refs] = line.split('|');
    const parentHashes = parents ? parents.trim().split(' ').filter(p => p) : [];
    
    // Parse refs to see which branches point to this commit
    const branchRefs = [];
    if (refs) {
      const refParts = refs.split(',').map(r => r.trim());
      for (const ref of refParts) {
        if (ref.includes('HEAD') || ref.includes('->')) continue;
        // Extract branch names from refs
        const branchMatch = ref.match(/(?:origin\/)?([^,\s]+)/);
        if (branchMatch) {
          branchRefs.push(branchMatch[1]);
        }
      }
    }
    
    // Check if this commit is a branch tip
    const branchTip = branchTipMap.get(hash);
    if (branchTip && !branchRefs.includes(branchTip)) {
      branchRefs.push(branchTip);
    }
    
    graphNodes.push({
      hash: hash.substring(0, 7), // Short hash for display
      fullHash: hash,
      author,
      email,
      timestamp: parseInt(timestamp),
      subject: subject.substring(0, 50), // Truncate long messages
      parents: parentHashes.map(p => p.substring(0, 7)),
      branches: branchRefs,
      isMerge: parentHashes.length > 1
    });
  }
  
  console.log(`Created ${graphNodes.length} graph nodes`);

  // Analyze branching patterns
  const branchingAnalysis = {
    patterns: [],
    strategy: 'Unknown',
    strategyExplanation: '',
    insights: [],
    workflow: 'Unknown',
    workflowExplanation: '',
    detectionCriteria: []
  };

  // Count branch types
  const featureBranches = branches.filter(b => b.name.includes('feature')).length;
  const bugfixBranches = branches.filter(b => b.name.includes('bugfix') || b.name.includes('fix')).length;
  const hotfixBranches = branches.filter(b => b.name.includes('hotfix')).length;
  const developBranches = branches.filter(b => b.name.includes('develop') || b.name.includes('dev')).length;
  const releaseBranches = branches.filter(b => b.name.includes('release')).length;
  
  // Analyze commit patterns to detect fork workflow
  const commitAuthors = new Set();
  const branchCreators = new Set();
  graphNodes.forEach(node => {
    commitAuthors.add(node.email);
  });
  branches.forEach(branch => {
    if (branch.email) branchCreators.add(branch.email);
  });
  
  // Check for merge commit patterns (sign of PR workflow)
  const mergeCommits = graphNodes.filter(n => n.isMerge);
  const totalCommits = graphNodes.length;
  const mergeRatio = totalCommits > 0 ? (mergeCommits.length / totalCommits * 100).toFixed(1) : 0;
  
  // Detect if commits are mainly on primary branch (no divergence)
  const commitsOnPrimary = graphNodes.filter(n => 
    n.branches.includes(primaryBranch) || 
    n.branches.includes('main') || 
    n.branches.includes('master')
  ).length;
  const primaryRatio = totalCommits > 0 ? (commitsOnPrimary / totalCommits * 100).toFixed(1) : 0;
  
  // Check for PR merge messages
  const prMergePatterns = [
    /merge pull request/i,
    /merge pr/i,
    /pull request #\d+/i,
    /\(#\d+\)/,  // GitHub PR number format
    /merged/i
  ];
  const prMerges = graphNodes.filter(n => 
    prMergePatterns.some(pattern => pattern.test(n.subject))
  ).length;
  const prMergeRatio = totalCommits > 0 ? (prMerges / totalCommits * 100).toFixed(1) : 0;
  
  // Detect workflow type
  if (prMerges > totalCommits * 0.1) {
    branchingAnalysis.workflow = 'Fork + Pull Request';
    branchingAnalysis.workflowExplanation = 'Contributors fork the repository, make changes in their fork, then submit pull requests back to the main repository. This is common in open source projects.';
    branchingAnalysis.detectionCriteria = [
      `✓ ${prMerges} commits (${prMergeRatio}%) contain PR merge messages`,
      `✓ ${primaryRatio}% of commits appear on primary branch`,
      `✓ Linear history suggests PRs are squashed or rebased`,
      `Pattern: Fork → Make changes → Submit PR → Merge to main`
    ];
    branchingAnalysis.insights.push(`${prMerges} commits mention pull requests`);
    branchingAnalysis.insights.push('Contributors likely working from forks');
    branchingAnalysis.insights.push('PRs may be squashed/rebased on merge');
  } else if (branches.length <= 2 && primaryRatio > 90) {
    branchingAnalysis.workflow = 'Direct Commit to Primary';
    branchingAnalysis.workflowExplanation = 'Team members push commits directly to the main branch without using feature branches or pull requests. Fast but risky for production code.';
    branchingAnalysis.detectionCriteria = [
      `✓ ${primaryRatio}% of commits directly on ${primaryBranch}`,
      `✓ Only ${branches.length} branches detected`,
      `✓ ${prMerges} PR merge messages found (${prMergeRatio}%)`,
      `Pattern: Local changes → Commit → Push directly to main`
    ];
    branchingAnalysis.insights.push(`${primaryRatio}% of commits directly on ${primaryBranch}`);
    branchingAnalysis.insights.push('No feature branch workflow detected');
    branchingAnalysis.insights.push('Team may be pushing directly to main');
  } else if (branches.length > 3 && primaryRatio < 70) {
    branchingAnalysis.workflow = 'Branch-based Development';
    branchingAnalysis.workflowExplanation = 'Developers create feature branches within the same repository, work on them, then merge back to main via pull requests or direct merges.';
    branchingAnalysis.detectionCriteria = [
      `✓ ${branches.length} active branches in repository`,
      `✓ ${(100 - primaryRatio).toFixed(1)}% of commits on feature branches`,
      `✓ ${mergeRatio}% of commits are merges`,
      `Pattern: Main → Create branch → Develop → Merge back to main`
    ];
    branchingAnalysis.insights.push('Multiple active branches detected');
    branchingAnalysis.insights.push(`${(100 - primaryRatio).toFixed(1)}% of work happens on feature branches`);
  } else {
    branchingAnalysis.workflow = 'Mixed Workflow';
    branchingAnalysis.workflowExplanation = 'The repository uses a combination of approaches - some direct commits, some branches, possibly some PRs. This is common during transitions or in teams with varied practices.';
    branchingAnalysis.detectionCriteria = [
      `✓ ${primaryRatio}% commits on primary branch`,
      `✓ ${branches.length} branches detected`,
      `✓ ${prMerges} PR merges (${prMergeRatio}%)`,
      `✓ ${mergeRatio}% merge commits`,
      `Pattern: Hybrid of direct commits, branches, and PRs`
    ];
    branchingAnalysis.insights.push(`${primaryRatio}% commits on primary branch`);
    branchingAnalysis.insights.push('Combination of direct commits and branches');
  }
  
  // Detect branching strategy
  if (developBranches > 0 && (featureBranches > 0 || releaseBranches > 0)) {
    branchingAnalysis.strategy = 'Git Flow';
    branchingAnalysis.strategyExplanation = 'A structured branching model with main/master for production, develop for integration, and feature/release/hotfix branches. Best for scheduled release cycles.';
    branchingAnalysis.insights.push('Uses develop branch as integration branch');
    if (releaseBranches > 0) {
      branchingAnalysis.insights.push('Uses release branches for production releases');
    }
  } else if (featureBranches > 3 && branches.length < 10) {
    branchingAnalysis.strategy = 'GitHub Flow';
    branchingAnalysis.strategyExplanation = 'Simple workflow with main/master as production-ready and feature branches for development. Deploy from main after every merge. Best for continuous deployment.';
    branchingAnalysis.insights.push('Simple branching from main/master');
  } else if (branches.length <= 3) {
    branchingAnalysis.strategy = 'Trunk-Based Development';
    branchingAnalysis.strategyExplanation = 'Developers work on main/trunk with minimal branching. Short-lived feature branches (if any) merge quickly. Requires strong CI/CD and feature flags.';
    branchingAnalysis.insights.push('Minimal long-lived branches');
  } else {
    branchingAnalysis.strategy = 'Custom Strategy';
    branchingAnalysis.strategyExplanation = 'This repository uses a unique branching pattern that doesn\'t match standard workflows. May be tailored to specific team needs.';
    branchingAnalysis.insights.push(`${branches.length} total branches`);
  }

  // Add pattern details
  if (featureBranches > 0) {
    branchingAnalysis.patterns.push({ type: 'Feature Branches', count: featureBranches });
  }
  if (bugfixBranches > 0) {
    branchingAnalysis.patterns.push({ type: 'Bugfix Branches', count: bugfixBranches });
  }
  if (hotfixBranches > 0) {
    branchingAnalysis.patterns.push({ type: 'Hotfix Branches', count: hotfixBranches });
  }
  if (developBranches > 0) {
    branchingAnalysis.patterns.push({ type: 'Development Branches', count: developBranches });
  }
  if (releaseBranches > 0) {
    branchingAnalysis.patterns.push({ type: 'Release Branches', count: releaseBranches });
  }

  // Add merge statistics
  branchingAnalysis.insights.push(`${mergeRatio}% of commits are merges`);
  
  // Contributor analysis
  if (commitAuthors.size !== branchCreators.size) {
    branchingAnalysis.insights.push(`${commitAuthors.size} unique commit authors`);
  }

  console.log('Branching strategy detected:', branchingAnalysis.strategy);
  console.log('Workflow type:', branchingAnalysis.workflow);

  // Parse branch creation data
  const branchCreationMap = new Map();
  const creationLines = branchCreationData.trim().split('\n').filter(line => line);
  for (const line of creationLines) {
    const parts = line.split('|');
    if (parts.length >= 2) {
      const branchName = parts[0];
      const creationDate = parts[1];
      branchCreationMap.set(branchName, creationDate);
    }
  }

  // Parse branch data
  const branchLines = branchData.trim().split('\n').filter(line => line);
  for (const line of branchLines) {
    const [name, author, email, lastCommitDate, creationDate, committer] = line.split('|');
    
    // Skip HEAD reference
    if (name.includes('HEAD')) continue;
    
    // Strip origin/ prefix for cleaner display
    const cleanName = name.replace('origin/', '');
    const createdDate = branchCreationMap.get(name) || creationDate;
    
    branches.push({
      name: cleanName,
      author: author || committer,
      email: email,
      lastUpdate: lastCommitDate,
      created: createdDate,
      isPrimary: cleanName === primaryBranch
    });
  }

  // Parse merge data
  const mergeLines = mergeData.trim().split('\n').filter(line => line);
  for (const line of mergeLines) {
    const [hash, author, email, time, subject, parents] = line.split('|');
    
    // Extract branch name from merge commit message
    let branchName = 'unknown';
    const branchMatch = subject.match(/Merge (?:branch|pull request) ['"]?([^'"'\s]+)['"]?/i);
    if (branchMatch) {
      branchName = branchMatch[1];
    }

    merges.push({
      hash,
      author,
      email,
      time,
      subject,
      branchName,
      parents: parents ? parents.split(' ').length - 1 : 0
    });
  }

  // Parse commit data
  const commitLines = commitData.trim().split('\n');
  let currentCommit = null;
  const commitTimeline = [];
  
  for (const line of commitLines) {
    if (line.includes('|')) {
      // New commit line - now includes timestamp and parents at the end
      const parts = line.split('|');
      if (parts.length >= 7) {
        const [hash, author, email, time, subject, body, timestamp, parents] = parts;
        currentCommit = {
          hash,
          author,
          email,
          time,
          subject,
          timestamp: timestamp ? parseInt(timestamp) : null,
          parents: parents ? parents.trim().split(' ').filter(p => p) : [],
          additions: 0,
          deletions: 0
        };

        // Add to timeline
        if (currentCommit.timestamp) {
          commitTimeline.push({
            timestamp: currentCommit.timestamp,
            author,
            email,
            subject
          });
        }

        // Initialize contributor if not exists
        if (!contributors.has(email)) {
          contributors.set(email, {
            name: author,
            email: email,
            commits: 0,
            additions: 0,
            deletions: 0,
            branches: [],
            merges: 0
          });
        }

        const contributor = contributors.get(email);
        contributor.commits++;
      }
    } else if (currentCommit && line.trim()) {
      // File change line (additions deletions filename)
      const parts = line.trim().split('\t');
      if (parts.length >= 2) {
        const additions = parseInt(parts[0]) || 0;
        const deletions = parseInt(parts[1]) || 0;
        
        currentCommit.additions += additions;
        currentCommit.deletions += deletions;
        
        const contributor = contributors.get(currentCommit.email);
        contributor.additions += additions;
        contributor.deletions += deletions;
      }
    }
  }

  // Group commits by date for timeline visualization
  const timelineByDate = new Map();
  for (const commit of commitTimeline) {
    const date = new Date(commit.timestamp * 1000);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!timelineByDate.has(dateKey)) {
      timelineByDate.set(dateKey, {
        date: dateKey,
        commits: 0,
        contributors: new Set()
      });
    }
    
    const dayData = timelineByDate.get(dateKey);
    dayData.commits++;
    dayData.contributors.add(commit.author);
  }

  // Convert to array and sort by date
  const timelineData = Array.from(timelineByDate.values())
    .map(day => ({
      date: day.date,
      commits: day.commits,
      contributors: day.contributors.size
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Count merges per contributor
  for (const merge of merges) {
    const contributor = contributors.get(merge.email);
    if (contributor) {
      contributor.merges++;
    }
  }

  // Associate branches with contributors
  for (const branch of branches) {
    const contributor = contributors.get(branch.email);
    if (contributor) {
      contributor.branches.push({
        name: branch.name,
        lastUpdate: branch.lastUpdate,
        created: branch.created,
        isPrimary: branch.isPrimary
      });
    }
  }

  return {
    contributors: Array.from(contributors.values()).sort((a, b) => b.commits - a.commits),
    totalCommits: Array.from(contributors.values()).reduce((sum, c) => sum + c.commits, 0),
    timeRange: TIME_RANGES[timeRange].label,
    primaryBranch: primaryBranch,
    totalBranches: branches.length,
    merges: merges.sort((a, b) => {
      // Sort by most recent (this is approximate since we have relative time)
      return 0; // They're already in chronological order from git log
    }),
    branches: branches,
    timeline: timelineData,
    graph: graphNodes,
    branchingAnalysis: branchingAnalysis
  };
}

// API endpoint to analyze a repository
app.post('/api/analyze', async (req, res) => {
  const { repoUrl, timeRange = 'week' } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: 'Repository URL is required' });
  }

  if (!TIME_RANGES[timeRange]) {
    return res.status(400).json({ error: 'Invalid time range' });
  }

  try {
    console.log(`Analyzing repository: ${repoUrl} for time range: ${timeRange}`);
    
    // Clone or update the repository
    const repoPath = await cloneOrUpdateRepo(repoUrl);
    
    // Get git data
    const { branchData, commitData, statsData, mergeData, branchCreationData, primaryBranch, branchTips, graphData } = await getGitData(repoPath, timeRange);
    
    // Parse and structure the data
    const analysisData = parseGitData(branchData, commitData, statsData, mergeData, branchCreationData, primaryBranch, branchTips, graphData, timeRange);
    
    res.json({
      success: true,
      repoUrl,
      timeRange,
      data: analysisData
    });
  } catch (error) {
    console.error('Error analyzing repository:', error);
    res.status(500).json({ 
      error: 'Failed to analyze repository',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
async function start() {
  await ensureReposDir();
  app.listen(PORT, () => {
    console.log(`Git Analysis API running on http://localhost:${PORT}`);
    console.log(`Ready to analyze repositories!`);
  });
}

start();