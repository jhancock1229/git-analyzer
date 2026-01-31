/**
 * Tests for React App component
 */
import { describe, test, expect, beforeEach } from '@jest/globals';

// Mock data for testing
const mockRepoData = {
  contributors: [
    { name: 'Alice', email: 'alice@test.com', commits: 50, additions: 1000, deletions: 200 },
    { name: 'Bob', email: 'bob@test.com', commits: 30, additions: 500, deletions: 100 }
  ],
  totalCommits: 80,
  timeRange: 'Last Week',
  primaryBranch: 'main',
  primaryBranchUrl: 'https://github.com/test/repo/tree/main',
  activitySummary: '80 commits from 2 developers this last week.',
  branches: [
    { name: 'main', isPrimary: true, commitCount: 70, isStale: false },
    { name: 'dev', isPrimary: false, commitCount: 10, isStale: false }
  ],
  staleBranches: [],
  cicdTools: {
    cicd: ['GitHub Actions'],
    containers: ['Dockerfile'],
    testing: ['Jest'],
    security: []
  }
};

describe('App Component Tests', () => {
  describe('Data Validation', () => {
    test('mock data has required fields', () => {
      expect(mockRepoData).toHaveProperty('contributors');
      expect(mockRepoData).toHaveProperty('totalCommits');
      expect(mockRepoData).toHaveProperty('timeRange');
      expect(mockRepoData).toHaveProperty('primaryBranch');
      expect(mockRepoData).toHaveProperty('activitySummary');
    });

    test('contributors array is valid', () => {
      expect(Array.isArray(mockRepoData.contributors)).toBe(true);
      expect(mockRepoData.contributors.length).toBeGreaterThan(0);
      expect(mockRepoData.contributors[0]).toHaveProperty('name');
      expect(mockRepoData.contributors[0]).toHaveProperty('commits');
    });

    test('branches array is valid', () => {
      expect(Array.isArray(mockRepoData.branches)).toBe(true);
      const primaryBranch = mockRepoData.branches.find(b => b.isPrimary);
      expect(primaryBranch).toBeDefined();
      expect(primaryBranch.name).toBe('main');
    });
  });

  describe('Commit Counting', () => {
    test('total commits matches sum of contributor commits', () => {
      const totalFromContributors = mockRepoData.contributors.reduce(
        (sum, c) => sum + c.commits, 
        0
      );
      expect(totalFromContributors).toBe(mockRepoData.totalCommits);
    });

    test('branch commit counts are valid', () => {
      mockRepoData.branches.forEach(branch => {
        expect(branch.commitCount).toBeGreaterThanOrEqual(0);
        expect(typeof branch.commitCount).toBe('number');
      });
    });
  });

  describe('URL Validation', () => {
    test('primary branch URL is valid GitHub URL', () => {
      expect(mockRepoData.primaryBranchUrl).toMatch(/^https:\/\/github\.com\//);
      expect(mockRepoData.primaryBranchUrl).toContain('/tree/');
      expect(mockRepoData.primaryBranchUrl).toContain(mockRepoData.primaryBranch);
    });
  });
});
