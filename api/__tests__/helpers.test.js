/**
 * Tests for GitHub API helper functions
 */

// Mock functions extracted from analyze.js for testing
function getTimeRangeDate(timeRange) {
  const ranges = { day: 1, week: 7, month: 30, quarter: 90, '6months': 180, year: 365 };
  if (timeRange === 'all') return null;
  const days = ranges[timeRange] || 7;
  const date = new Date('2026-01-31T12:00:00Z'); // Fixed date for testing
  date.setDate(date.getDate() - days);
  return date.toISOString();
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

function parseGitHubUrl(repoUrl) {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

describe('GitHub Helper Functions', () => {
  describe('getTimeRangeDate', () => {
    test('returns null for "all" time range', () => {
      expect(getTimeRangeDate('all')).toBeNull();
    });

    test('returns correct date for week', () => {
      const result = getTimeRangeDate('week');
      expect(result).toBe('2026-01-24T12:00:00.000Z');
    });

    test('returns correct date for month', () => {
      const result = getTimeRangeDate('month');
      expect(result).toBe('2026-01-01T12:00:00.000Z');
    });

    test('returns correct date for quarter', () => {
      const result = getTimeRangeDate('quarter');
      expect(result).toBe('2025-11-02T12:00:00.000Z');
    });

    test('defaults to week for unknown range', () => {
      const result = getTimeRangeDate('unknown');
      expect(result).toBe('2026-01-24T12:00:00.000Z');
    });
  });

  describe('getTimeRangeLabel', () => {
    test('returns correct label for each range', () => {
      expect(getTimeRangeLabel('day')).toBe('Last 24 Hours');
      expect(getTimeRangeLabel('week')).toBe('Last Week');
      expect(getTimeRangeLabel('month')).toBe('Last Month');
      expect(getTimeRangeLabel('quarter')).toBe('Last Quarter');
      expect(getTimeRangeLabel('6months')).toBe('Last 6 Months');
      expect(getTimeRangeLabel('year')).toBe('Last Year');
      expect(getTimeRangeLabel('all')).toBe('All Time');
    });

    test('defaults to "Last Week" for unknown range', () => {
      expect(getTimeRangeLabel('unknown')).toBe('Last Week');
    });
  });

  describe('parseGitHubUrl', () => {
    test('parses standard GitHub URL', () => {
      const result = parseGitHubUrl('https://github.com/pytorch/pytorch');
      expect(result).toEqual({ owner: 'pytorch', repo: 'pytorch' });
    });

    test('parses GitHub URL with .git extension', () => {
      const result = parseGitHubUrl('https://github.com/facebook/react.git');
      expect(result).toEqual({ owner: 'facebook', repo: 'react' });
    });

    test('parses GitHub URL without https', () => {
      const result = parseGitHubUrl('github.com/vercel/next.js');
      expect(result).toEqual({ owner: 'vercel', repo: 'next.js' });
    });

    test('throws error for invalid URL', () => {
      expect(() => parseGitHubUrl('not-a-github-url')).toThrow('Invalid GitHub URL');
    });
  });
});
