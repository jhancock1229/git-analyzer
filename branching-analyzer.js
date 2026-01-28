function analyzeBranchingPatterns(branches, graphNodes, mergedPRs, primaryBranch) {
  const analysis = {
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
  const bugfixBranches = branches.filter(b => b.name.includes('fix')).length;
  const developBranches = branches.filter(b => b.name.includes('develop') || b.name.includes('dev')).length;
  const hotfixBranches = branches.filter(b => b.name.includes('hotfix')).length;
  const releaseBranches = branches.filter(b => b.name.includes('release')).length;
  
  const totalCommits = graphNodes.length;
  const mergeCommits = graphNodes.filter(n => n.isMerge).length;
  const mergeRatio = totalCommits > 0 ? (mergeCommits / totalCommits * 100).toFixed(1) : 0;
  
  const prCount = mergedPRs.length;
  const prRatio = totalCommits > 0 ? (prCount / totalCommits * 100).toFixed(1) : 0;
  
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
  if (developBranches > 0 && (featureBranches > 0 || releaseBranches > 0)) {
    analysis.strategy = 'Git Flow';
    analysis.strategyExplanation = 'A structured branching model with main/master for production, develop for integration, and feature/release/hotfix branches. Best for scheduled release cycles.';
  } else if (featureBranches > 3) {
    analysis.strategy = 'GitHub Flow';
    analysis.strategyExplanation = 'Simple workflow with main/master as production-ready and feature branches for development. Deploy from main after every merge. Best for continuous deployment.';
  } else if (branches.length <= 3) {
    analysis.strategy = 'Trunk-Based Development';
    analysis.strategyExplanation = 'Developers work on main/trunk with minimal branching. Short-lived feature branches (if any) merge quickly. Requires strong CI/CD and feature flags.';
  } else {
    analysis.strategy = 'Custom Strategy';
    analysis.strategyExplanation = 'This repository uses a unique branching pattern that doesn\'t match standard workflows.';
  }
  
  // Add patterns
  if (featureBranches > 0) {
    analysis.patterns.push({ type: 'Feature Branches', count: featureBranches });
  }
  if (bugfixBranches > 0) {
    analysis.patterns.push({ type: 'Bugfix Branches', count: bugfixBranches });
  }
  if (hotfixBranches > 0) {
    analysis.patterns.push({ type: 'Hotfix Branches', count: hotfixBranches });
  }
  if (developBranches > 0) {
    analysis.patterns.push({ type: 'Development Branches', count: developBranches });
  }
  if (releaseBranches > 0) {
    analysis.patterns.push({ type: 'Release Branches', count: releaseBranches });
  }
  
  analysis.insights.push(`${mergeRatio}% of commits are merges`);
  analysis.insights.push(`${branches.length} total branches`);
  
  return analysis;
}

module.exports = {
  analyzeBranchingPatterns
};