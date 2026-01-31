/**
 * Tests for commit analysis and categorization
 */

// Mock analysis functions for testing
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

describe('Commit Analysis', () => {
  describe('categorizeByMessage', () => {
    const sampleCommits = [
      { message: 'feat: Add new user authentication' },
      { message: 'fix: Fix memory leak in component' },
      { message: 'perf: Optimize database queries' },
      { message: 'test: Add unit tests for API' },
      { message: 'docs: Update README with examples' },
      { message: 'refactor: Clean up legacy code' },
      { message: 'Add support for OAuth' },
      { message: 'Bug fix for crash on startup' },
      { message: 'Update component rendering' }
    ];

    test('categorizes feature commits', () => {
      const result = categorizeByMessage(sampleCommits);
      expect(result['Features & Enhancements']).toContain('feat: Add new user authentication');
      expect(result['Features & Enhancements']).toContain('Add support for OAuth');
      expect(result['Features & Enhancements'].length).toBe(2);
    });

    test('categorizes bug fixes', () => {
      const result = categorizeByMessage(sampleCommits);
      expect(result['Bug Fixes']).toContain('fix: Fix memory leak in component');
      expect(result['Bug Fixes']).toContain('Bug fix for crash on startup');
      expect(result['Bug Fixes'].length).toBe(2);
    });

    test('categorizes performance improvements', () => {
      const result = categorizeByMessage(sampleCommits);
      expect(result['Performance']).toContain('perf: Optimize database queries');
      expect(result['Performance'].length).toBe(1);
    });

    test('categorizes testing commits', () => {
      const result = categorizeByMessage(sampleCommits);
      expect(result['Testing']).toContain('test: Add unit tests for API');
    });

    test('categorizes documentation commits', () => {
      const result = categorizeByMessage(sampleCommits);
      expect(result['Documentation']).toContain('docs: Update README with examples');
    });

    test('categorizes refactoring commits', () => {
      const result = categorizeByMessage(sampleCommits);
      expect(result['Refactoring']).toContain('refactor: Clean up legacy code');
    });

    test('handles empty commit list', () => {
      const result = categorizeByMessage([]);
      expect(Object.values(result).every(arr => arr.length === 0)).toBe(true);
    });

    test('handles commits with nested message structure', () => {
      const commits = [
        { commit: { message: 'feat: New feature\n\nDetailed description' } }
      ];
      const result = categorizeByMessage(commits);
      expect(result['Features & Enhancements']).toContain('feat: New feature');
    });
  });
});
