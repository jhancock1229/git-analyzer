const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

const rateLimitState = {
  lastRequestTime: 0,
  resetTime: 0,
  isThrottled: false
};

const MIN_REQUEST_INTERVAL = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const now = Date.now();
      const timeSinceLastRequest = now - rateLimitState.lastRequestTime;
      
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await sleep(waitTime);
      }
      
      rateLimitState.lastRequestTime = Date.now();
      
      const response = await fetch(url, options);
      
      const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '999');
      const resetTime = parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000;
      
      if (remaining < 10) {
        rateLimitState.isThrottled = true;
        rateLimitState.resetTime = resetTime;
      }
      
      if (response.status === 403 || response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        
        if (attempt < maxRetries - 1) {
          await sleep(waitTime);
          continue;
        } else {
          throw new Error('Rate limit exceeded. Please wait a few minutes before trying again.');
        }
      }
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      return response;
      
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      const waitTime = Math.pow(2, attempt) * 1000;
      await sleep(waitTime);
    }
  }
}

function getCacheKey(owner, repo, timeRange) {
  return `${owner}/${repo}/${timeRange}`;
}

function getFromCache(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { repoUrl, timeRange = 'week' } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: 'Repository URL is required' });
  }

  try {
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = repoUrl.match(urlPattern);

    if (!match) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL' });
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');

    const cacheKey = getCacheKey(owner, cleanRepo, timeRange);
    const cachedData = getFromCache(cacheKey);
    
    if (cachedData) {
      return res.status(200).json({
        ...cachedData,
        fromCache: true
      });
    }

    if (rateLimitState.isThrottled) {
      const now = Date.now();
      if (now < rateLimitState.resetTime) {
        const waitSeconds = Math.ceil((rateLimitState.resetTime - now) / 1000);
        return res.status(429).json({
          error: `Rate limit protection active. Please wait ${waitSeconds} seconds.`,
          retryAfter: waitSeconds
        });
      } else {
        rateLimitState.isThrottled = false;
      }
    }

    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    
    if (!token) {
      return res.status(500).json({ 
        error: 'GitHub token not configured. Please add GH_TOKEN to environment variables.'
      });
    }

    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Git-Analyzer-App'
    };

    const now = new Date();
    const timeRanges = {
      'day': 1,
      'week': 7,
      'month': 30,
      'quarter': 90,
      '6months': 180,
      'year': 365,
      'all': 36500
    };

    const daysAgo = timeRanges[timeRange] || 7;
    const since = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const sinceISO = since.toISOString();

    const repoResponse = await fetchWithRetry(
      `https://api.github.com/repos/${owner}/${cleanRepo}`,
      { headers }
    );
    const repoInfo = await repoResponse.json();

    let allCommits = [];
    let page = 1;
    const maxCommits = 100; // Reduced from 335

    while (allCommits.length < maxCommits) {
      const commitsResponse = await fetchWithRetry(
        `https://api.github.com/repos/${owner}/${cleanRepo}/commits?since=${sinceISO}&per_page=100&page=${page}`,
        { headers }
      );
      
      const commits = await commitsResponse.json();
      
      if (!commits || commits.length === 0) break;
      
      allCommits = allCommits.concat(commits);
      
      if (commits.length < 100) break;
      if (allCommits.length >= maxCommits) {
        allCommits = allCommits.slice(0, maxCommits);
        break;
      }
      
      page++;
      await sleep(200); // Reduced from 500
    }

    const prNumbers = new Set();
    allCommits.forEach(commit => {
      const message = commit.commit.message;
      const prMatch = message.match(/\(#(\d+)\)/);
      if (prMatch) {
        prNumbers.add(parseInt(prMatch[1]));
      }
    });

    let pullRequests = [];
    const prNumbersArray = Array.from(prNumbers).slice(0, 20); // Reduced from 50
    
    for (const prNumber of prNumbersArray) {
      try {
        const prResponse = await fetchWithRetry(
          `https://api.github.com/repos/${owner}/${cleanRepo}/pulls/${prNumber}`,
          { headers }
        );
        
        const pr = await prResponse.json();
        pullRequests.push(pr);
        
        await sleep(100); // Reduced from 300
        
      } catch (error) {
        console.log(`Failed to fetch PR #${prNumber}`);
      }
    }

    function analyzeCommitMessages(commits) {
      const categories = {
        features: 0,
        bugFixes: 0,
        performance: 0,
        security: 0,
        tests: 0,
        docs: 0,
        refactor: 0,
        other: 0
      };

      const areas = {};

      commits.forEach(commit => {
        const msg = commit.commit.message.toLowerCase();

        if (msg.includes('feat:') || msg.includes('add') || msg.includes('new') || msg.includes('implement')) {
          categories.features++;
        } else if (msg.includes('fix:') || msg.includes('bug') || msg.includes('issue') || msg.includes('resolve')) {
          categories.bugFixes++;
        } else if (msg.includes('perf:') || msg.includes('optimize') || msg.includes('speed')) {
          categories.performance++;
        } else if (msg.includes('security') || msg.includes('vulnerability') || msg.includes('auth')) {
          categories.security++;
        } else if (msg.includes('test:') || msg.includes('add tests') || msg.includes('unit test')) {
          categories.tests++;
        } else if (msg.includes('docs:') || msg.includes('documentation') || msg.includes('readme')) {
          categories.docs++;
        } else if (msg.includes('refactor:') || msg.includes('refactor') || msg.includes('cleanup')) {
          categories.refactor++;
        } else {
          categories.other++;
        }

        const areaMatch = msg.match(/\(([^)]+)\):/);
        if (areaMatch) {
          const area = areaMatch[1];
          areas[area] = (areas[area] || 0) + 1;
        }
      });

      return { categories, areas };
    }

    const analysis = analyzeCommitMessages(allCommits);

    const contributors = {};
    allCommits.forEach(commit => {
      const author = commit.commit.author.name || commit.commit.author.email;
      if (!contributors[author]) {
        contributors[author] = {
          name: author,
          commits: 0
        };
      }
      contributors[author].commits++;
    });

    const sortedContributors = Object.values(contributors)
      .sort((a, b) => b.commits - a.commits);

    const totalDevelopers = sortedContributors.length;
    const totalCommits = allCommits.length;
    const { features, bugFixes, tests } = analysis.categories;
    
    const topAreas = Object.entries(analysis.areas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([area]) => area);

    let summary = '';
    
    if (totalCommits > 100) {
      summary += `Very active ${timeRange}: `;
    } else if (totalCommits > 50) {
      summary += `Busy ${timeRange}: `;
    } else if (totalCommits > 20) {
      summary += `Steady ${timeRange}: `;
    } else {
      summary += `Quiet ${timeRange}: `;
    }

    summary += `${totalDevelopers} developer${totalDevelopers !== 1 ? 's' : ''} ${totalCommits > 50 ? 'pushed' : 'made'} ${totalCommits} commit${totalCommits !== 1 ? 's' : ''}. `;

    const workItems = [];
    if (features > 0) workItems.push(`${features} feature${features !== 1 ? 's' : ''} added`);
    if (bugFixes > 0) workItems.push(`${bugFixes} bug${bugFixes !== 1 ? 's' : ''} fixed`);
    if (workItems.length > 0) {
      summary += `Work included: ${workItems.join(', ')}`;
      if (bugFixes > features && bugFixes > 5) {
        summary += ' (stability focus)';
      }
    }

    if (topAreas.length > 0) {
      summary += `. ${topAreas.length > 1 ? 'Active in' : 'Focus'}: ${topAreas.join(', ')}`;
    }

    if (tests > totalCommits * 0.2) {
      summary += '. Strong testing culture';
    }

    summary += '.';

    const mergedPRs = pullRequests.filter(pr => 
      pr.merged_at && 
      new Date(pr.merged_at) >= since
    );

    const responseData = {
      repository: {
        name: repoInfo.full_name,
        description: repoInfo.description,
        stars: repoInfo.stargazers_count,
        forks: repoInfo.forks_count,
        openIssues: repoInfo.open_issues_count,
        language: repoInfo.language,
        url: repoInfo.html_url
      },
      timeRange: {
        value: timeRange,
        since: sinceISO,
        daysAgo
      },
      summary,
      stats: {
        totalCommits: allCommits.length,
        totalContributors: sortedContributors.length,
        totalPRs: mergedPRs.length,
        categories: analysis.categories,
        topAreas: topAreas.slice(0, 5)
      },
      contributors: sortedContributors.slice(0, 10),
      recentCommits: allCommits.slice(0, 20).map(commit => ({
        message: commit.commit.message.split('\n')[0],
        author: commit.commit.author.name,
        date: commit.commit.author.date,
        sha: commit.sha.substring(0, 7),
        url: commit.html_url
      })),
      recentPRs: mergedPRs.slice(0, 10).map(pr => ({
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        mergedAt: pr.merged_at,
        url: pr.html_url
      }))
    };

    setCache(cacheKey, responseData);

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Error:', error);
    
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({ 
        error: error.message,
        retryAfter: 300
      });
    }
    
    return res.status(500).json({ 
      error: error.message || 'Failed to analyze repository'
    });
  }
};
