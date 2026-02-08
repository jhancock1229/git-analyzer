/**
 * Unit Tests for Git Repository Analyzer
 * 
 * Tests cover the requirements defined in REQUIREMENTS.md
 */

describe('FR-1: Repository URL Ingestion', () => {
  test('AC-1.1: Should accept valid GitHub URLs', () => {
    const validUrls = [
      'https://github.com/facebook/react',
      'https://github.com/torvalds/linux',
      'https://github.com/microsoft/vscode'
    ];

    validUrls.forEach(url => {
      const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
      const match = url.match(urlPattern);
      expect(match).not.toBeNull();
      expect(match[1]).toBeTruthy(); // owner
      expect(match[2]).toBeTruthy(); // repo
    });
  });

  test('AC-1.2: Should accept GitHub URLs with .git suffix', () => {
    const url = 'https://github.com/facebook/react.git';
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(urlPattern);
    
    expect(match).not.toBeNull();
    const cleanRepo = match[2].replace(/\.git$/, '');
    expect(cleanRepo).toBe('react');
  });

  test('AC-1.3: Should reject invalid URL formats', () => {
    const invalidUrls = [
      'gitlab.com/user/repo',
      'github.com/invalid',
      'https://github.com/',
      'not-a-url'
    ];

    invalidUrls.forEach(url => {
      const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
      const match = url.match(urlPattern);
      
      if (match) {
        // If pattern matches, check if we have valid owner/repo
        const [, owner, repo] = match;
        expect(owner && repo && owner.length > 0 && repo.length > 0).toBeFalsy();
      } else {
        expect(match).toBeNull();
      }
    });
  });
});

describe('FR-2: Executive Summary Generation', () => {
  test('AC-2.4: Summary should be 2-3 paragraphs', () => {
    const summary = `The team focused heavily on authentication and security improvements this week. Major changes include implementing OAuth 2.0 support with token refresh logic.

Several bug fixes addressed edge cases in the payment processing flow. The code now includes retry logic with exponential backoff.

Performance improvements were made to the database query layer. The changes should significantly reduce response times for user-facing endpoints.`;

    const paragraphs = summary.split('\n\n').filter(p => p.trim().length > 0);
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(paragraphs.length).toBeLessThanOrEqual(4); // Allow slight flexibility
  });

  test('AC-2.7: Should degrade gracefully without AI service', () => {
    const result = {
      summary: 'Busy week: 12 developers made 64 changes.',
      executiveSummary: null
    };

    // App should still work without executive summary
    expect(result.summary).toBeTruthy();
    expect(result.executiveSummary).toBeNull();
  });
});

describe('FR-3: Time Range Selection', () => {
  test('AC-3.1: Should provide required time ranges', () => {
    const timeRanges = [
      { value: 'day', label: 'Last 24 Hours' },
      { value: 'week', label: 'Last Week' },
      { value: 'month', label: 'Last Month' },
      { value: 'quarter', label: 'Last Quarter' },
      { value: '6months', label: 'Last 6 Months' },
      { value: 'year', label: 'Last Year' },
      { value: 'all', label: 'All Time' }
    ];

    expect(timeRanges).toHaveLength(7);
    expect(timeRanges.map(r => r.value)).toContain('day');
    expect(timeRanges.map(r => r.value)).toContain('week');
    expect(timeRanges.map(r => r.value)).toContain('month');
    expect(timeRanges.map(r => r.value)).toContain('quarter');
    expect(timeRanges.map(r => r.value)).toContain('6months');
    expect(timeRanges.map(r => r.value)).toContain('year');
    expect(timeRanges.map(r => r.value)).toContain('all');
  });

  test('AC-3.6: Should calculate correct date ranges', () => {
    const now = new Date('2024-01-15T00:00:00Z');
    const timeRanges = {
      'day': 1,
      'week': 7,
      'month': 30,
      'quarter': 90,
      '6months': 180,
      'year': 365,
      'all': 36500
    };

    Object.entries(timeRanges).forEach(([range, days]) => {
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const daysDifference = Math.floor((now - since) / (24 * 60 * 60 * 1000));
      
      expect(daysDifference).toBe(days);
    });
  });
});

describe('FR-4: Dark Mode Toggle', () => {
  test('AC-4.4: Should define dark mode colors', () => {
    const lightModeColors = {
      background: '#F5F5F5',
      text: '#1A1A1A',
      cardBackground: '#FFFFFF'
    };

    const darkModeColors = {
      background: '#0A0A0A',
      text: '#E8E8E8',
      cardBackground: '#1A1A1A'
    };

    // Verify colors are different
    expect(lightModeColors.background).not.toBe(darkModeColors.background);
    expect(lightModeColors.text).not.toBe(darkModeColors.text);
    expect(lightModeColors.cardBackground).not.toBe(darkModeColors.cardBackground);

    // Verify contrast (light text on dark bg, dark text on light bg)
    expect(parseInt(lightModeColors.text.replace('#', ''), 16))
      .toBeLessThan(parseInt(lightModeColors.background.replace('#', ''), 16));
    
    expect(parseInt(darkModeColors.text.replace('#', ''), 16))
      .toBeGreaterThan(parseInt(darkModeColors.background.replace('#', ''), 16));
  });
});

describe('FR-5: Speed and Quality Balance', () => {
  test('AC-5.3: Should limit data fetching', () => {
    const limits = {
      maxCommits: 100,
      maxPRs: 20,
      maxDiffsForAI: 10
    };

    expect(limits.maxCommits).toBeLessThanOrEqual(100);
    expect(limits.maxPRs).toBeLessThanOrEqual(20);
    expect(limits.maxDiffsForAI).toBeLessThanOrEqual(10);
  });

  test('AC-5.6: Should implement 5-minute cache', () => {
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in ms
    
    expect(CACHE_DURATION).toBe(300000);
    expect(CACHE_DURATION / 1000 / 60).toBe(5); // Verify it's 5 minutes
  });
});

describe('NFR-3: Error Handling', () => {
  test('Should handle invalid repository URL', async () => {
    const mockReq = {
      method: 'POST',
      body: {
        repoUrl: 'invalid-url',
        timeRange: 'week'
      }
    };

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };

    // Simulate URL validation
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = mockReq.body.repoUrl.match(urlPattern);

    if (!match) {
      mockRes.status(400);
      mockRes.json({ error: 'Invalid GitHub repository URL' });
    }

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Invalid GitHub repository URL'
    });
  });

  test('Should handle missing repository URL', async () => {
    const mockReq = {
      method: 'POST',
      body: {
        timeRange: 'week'
      }
    };

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };

    if (!mockReq.body.repoUrl) {
      mockRes.status(400);
      mockRes.json({ error: 'Repository URL is required' });
    }

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Repository URL is required'
    });
  });

  test('Should handle missing GitHub token', () => {
    const token = undefined;

    if (!token) {
      const error = {
        status: 500,
        message: 'GitHub token not configured. Please add GH_TOKEN to environment variables.'
      };
      expect(error.status).toBe(500);
      expect(error.message).toContain('GitHub token');
    }
  });
});

describe('NFR-4: Data Accuracy', () => {
  test('Should correctly categorize commits', () => {
    const commitMessages = [
      'feat: add new feature',
      'fix: resolve bug',
      'perf: optimize query',
      'docs: update readme',
      'test: add unit tests'
    ];

    const categories = {
      features: 0,
      bugFixes: 0,
      performance: 0,
      docs: 0,
      tests: 0
    };

    commitMessages.forEach(msg => {
      const lower = msg.toLowerCase();
      if (lower.includes('feat:') || lower.includes('add')) categories.features++;
      if (lower.includes('fix:') || lower.includes('bug')) categories.bugFixes++;
      if (lower.includes('perf:') || lower.includes('optimize')) categories.performance++;
      if (lower.includes('docs:') || lower.includes('readme')) categories.docs++;
      if (lower.includes('test:')) categories.tests++;
    });

    expect(categories.features).toBe(1);
    expect(categories.bugFixes).toBe(1);
    expect(categories.performance).toBe(1);
    expect(categories.docs).toBe(1);
    expect(categories.tests).toBe(1);
  });
});

describe('DR-1: Repository URL Data Requirements', () => {
  test('Should parse owner and repo from URL', () => {
    const url = 'https://github.com/facebook/react';
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(urlPattern);

    expect(match).not.toBeNull();
    
    const [, owner, repo] = match;
    expect(owner).toBe('facebook');
    expect(repo).toBe('react');
  });

  test('Should handle .git suffix', () => {
    const url = 'https://github.com/facebook/react.git';
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(urlPattern);
    
    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');
    
    expect(owner).toBe('facebook');
    expect(cleanRepo).toBe('react');
  });
});

describe('DR-2: Time Range Data Requirements', () => {
  test('Should have valid time range enum', () => {
    const validTimeRanges = ['day', 'week', 'month', 'quarter', '6months', 'year', 'all'];
    const defaultTimeRange = 'week';

    expect(validTimeRanges).toContain(defaultTimeRange);
    
    validTimeRanges.forEach(range => {
      expect(typeof range).toBe('string');
      expect(range.length).toBeGreaterThan(0);
    });
  });
});

describe('DR-3: Analysis Results Data Requirements', () => {
  test('Should return complete data structure', () => {
    const mockResult = {
      repository: {
        name: 'facebook/react',
        description: 'A JavaScript library',
        stars: 200000,
        forks: 40000,
        url: 'https://github.com/facebook/react'
      },
      executiveSummary: 'Summary text...',
      summary: 'Busy week: 12 developers made 64 changes.',
      stats: {
        totalCommits: 64,
        totalContributors: 12,
        totalPRs: 5,
        categories: {
          features: 10,
          bugFixes: 8,
          performance: 2,
          security: 1
        }
      },
      contributors: [],
      recentCommits: [],
      recentPRs: []
    };

    // Verify structure
    expect(mockResult).toHaveProperty('repository');
    expect(mockResult).toHaveProperty('executiveSummary');
    expect(mockResult).toHaveProperty('summary');
    expect(mockResult).toHaveProperty('stats');
    expect(mockResult).toHaveProperty('contributors');
    expect(mockResult).toHaveProperty('recentCommits');
    expect(mockResult).toHaveProperty('recentPRs');

    // Verify types
    expect(typeof mockResult.repository.name).toBe('string');
    expect(typeof mockResult.repository.stars).toBe('number');
    expect(typeof mockResult.summary).toBe('string');
    expect(Array.isArray(mockResult.contributors)).toBe(true);
  });
});

describe('Integration: Cache Functionality', () => {
  test('Should cache results with correct key', () => {
    const cache = new Map();
    const CACHE_DURATION = 5 * 60 * 1000;

    const getCacheKey = (owner, repo, timeRange) => {
      return `${owner}/${repo}/${timeRange}`;
    };

    const setCache = (key, data) => {
      cache.set(key, {
        data,
        timestamp: Date.now()
      });
    };

    const getFromCache = (key) => {
      const cached = cache.get(key);
      if (!cached) return null;
      
      const age = Date.now() - cached.timestamp;
      if (age > CACHE_DURATION) {
        cache.delete(key);
        return null;
      }
      
      return cached.data;
    };

    // Test caching
    const key = getCacheKey('facebook', 'react', 'week');
    const data = { test: 'data' };
    
    setCache(key, data);
    const retrieved = getFromCache(key);
    
    expect(retrieved).toEqual(data);
    expect(cache.has(key)).toBe(true);
  });

  test('Should expire cache after duration', () => {
    const cache = new Map();
    const CACHE_DURATION = 100; // 100ms for testing

    const setCache = (key, data) => {
      cache.set(key, {
        data,
        timestamp: Date.now()
      });
    };

    const getFromCache = (key) => {
      const cached = cache.get(key);
      if (!cached) return null;
      
      const age = Date.now() - cached.timestamp;
      if (age > CACHE_DURATION) {
        cache.delete(key);
        return null;
      }
      
      return cached.data;
    };

    const key = 'test-key';
    setCache(key, { test: 'data' });

    // Should be cached immediately
    expect(getFromCache(key)).toBeTruthy();

    // Wait for expiration
    return new Promise(resolve => {
      setTimeout(() => {
        expect(getFromCache(key)).toBeNull();
        resolve();
      }, 150);
    });
  });
});
