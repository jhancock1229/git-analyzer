import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import './App.css';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#ffb347'];

function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [timeRange, setTimeRange] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [cachedResult, setCachedResult] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  
  // Organic git graph that builds step by step
  const [commits, setCommits] = useState([]);
  const [branches, setBranches] = useState([]);
  const [activeBranches, setActiveBranches] = useState([]);
  const [nextCommitId, setNextCommitId] = useState(0);

  // Generate next organic commit
  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setCommits(prev => {
        // Keep only recent commits to prevent memory issues
        const recentCommits = prev.slice(-50);
        
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
        const currentX = recentCommits.length > 0 
          ? recentCommits[recentCommits.length - 1].x + 40 
          : 40;
        
        // Decide action: continue main, start branch, or merge branch
        const rand = Math.random();
        let newCommit;
        
        if (activeBranches.length > 0 && rand > 0.7) {
          // Merge a branch back to main
          const branch = activeBranches[0];
          newCommit = {
            id: nextCommitId,
            x: currentX,
            y: 120,
            color: '#3B82F6',
            branch: 'main',
            mergeFrom: branch.y
          };
          setActiveBranches(ab => ab.slice(1));
        } else if (rand > 0.5 && activeBranches.length < 3) {
          // Start a new branch
          const branchY = 120 + (Math.random() > 0.5 ? -1 : 1) * (50 + Math.random() * 50);
          const branchColor = colors[Math.floor(Math.random() * (colors.length - 1)) + 1];
          
          newCommit = {
            id: nextCommitId,
            x: currentX,
            y: branchY,
            color: branchColor,
            branch: `branch-${nextCommitId}`,
            branchFrom: 120
          };
          
          setActiveBranches(ab => [...ab, { y: branchY, color: branchColor, name: `branch-${nextCommitId}` }]);
        } else if (activeBranches.length > 0 && rand > 0.3) {
          // Continue on an active branch
          const branch = activeBranches[Math.floor(Math.random() * activeBranches.length)];
          newCommit = {
            id: nextCommitId,
            x: currentX,
            y: branch.y,
            color: branch.color,
            branch: branch.name
          };
        } else {
          // Continue on main branch
          newCommit = {
            id: nextCommitId,
            x: currentX,
            y: 120,
            color: '#3B82F6',
            branch: 'main'
          };
        }
        
        setNextCommitId(id => id + 1);
        return [...recentCommits, newCommit];
      });
    }, 600); // New commit every 600ms

    return () => clearInterval(interval);
  }, [loading, nextCommitId, activeBranches]);

  // Apply dark mode to body element
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const timeRanges = [
    { value: 'day', label: 'Last 24 Hours' },
    { value: 'week', label: 'Last Week' },
    { value: 'month', label: 'Last Month' },
    { value: 'quarter', label: 'Last Quarter' },
    { value: '6months', label: 'Last 6 Months' },
    { value: 'year', label: 'Last Year' },
    { value: 'all', label: 'All Time' }
  ];

  // Countdown timer for rate limit retry
  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => {
        setRetryCountdown(retryCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [retryCountdown]);

  const analyzeRepository = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }

    setLoading(true);
    setError(null);
    setRateLimitInfo(null);
    setCachedResult(false);

    try {
      const apiUrl = import.meta.env.PROD 
        ? '/api/analyze'
        : 'http://localhost:3001/api/analyze';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          timeRange
        })
      });

      const result = await response.json();

      if (response.status === 429) {
        // Rate limit hit
        const retryAfter = result.retryAfter || 300;
        setRetryCountdown(retryAfter);
        setError(result.error || 'Rate limit reached. Please wait before trying again.');
        setRateLimitInfo({
          limited: true,
          retryAfter,
          message: 'To protect against API limits, please wait before making another request.'
        });
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze repository');
      }

      setData(result);
      setCachedResult(result.fromCache || false);

      if (result.fromCache) {
        setRateLimitInfo({
          limited: false,
          cached: true,
          message: 'Results served from cache (no API calls used)'
        });
      }

    } catch (err) {
      setError(err.message || 'An error occurred while analyzing the repository');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    analyzeRepository();
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  const getCategoryChartData = () => {
    if (!data?.stats?.categories) return [];
    
    const categories = data.stats.categories;
    return [
      { name: 'Features', value: categories.features, color: COLORS[0] },
      { name: 'Bug Fixes', value: categories.bugFixes, color: COLORS[1] },
      { name: 'Performance', value: categories.performance, color: COLORS[2] },
      { name: 'Security', value: categories.security, color: COLORS[3] },
      { name: 'Tests', value: categories.tests, color: COLORS[4] },
      { name: 'Docs', value: categories.docs, color: COLORS[5] },
      { name: 'Refactor', value: categories.refactor, color: COLORS[6] },
    ].filter(item => item.value > 0);
  };

  const getContributorChartData = () => {
    if (!data?.contributors) return [];
    return data.contributors.slice(0, 8).map(c => ({
      name: c.name.split(' ')[0] || c.name,
      commits: c.commits
    }));
  };

  return (
    <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
      <button 
        className="dark-mode-toggle"
        onClick={() => setDarkMode(!darkMode)}
        aria-label="Toggle dark mode"
      >
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="header">
        <h1>Recap</h1>
      </div>

      <form onSubmit={handleSubmit} className="search-form">
        <div className="form-group">
          <label htmlFor="repo-url">REPOSITORY URL</label>
          <input
            id="repo-url"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="Enter GitHub repository URL (e.g., https://github.com/facebook/react)"
            className="repo-input"
            disabled={loading || retryCountdown > 0}
          />
        </div>

        <div className="form-row">
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="time-range">TIME RANGE</label>
            <select 
              id="time-range"
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="time-select"
              disabled={loading || retryCountdown > 0}
            >
              {timeRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          <button 
            type="submit" 
            disabled={loading || retryCountdown > 0}
            className="analyze-btn"
            style={{ alignSelf: 'end' }}
          >
            {loading ? 'Analyzing...' : retryCountdown > 0 ? `Wait ${retryCountdown}s` : 'ANALYZE REPOSITORY'}
          </button>
        </div>
      </form>

      {rateLimitInfo && (
        <div className={`rate-limit-info ${rateLimitInfo.limited ? 'warning' : 'info'}`}>
          <strong>{rateLimitInfo.limited ? '⚠️ Rate Limit Protection Active' : '✅ Cache Hit'}</strong>
          <p>{rateLimitInfo.message}</p>
          {rateLimitInfo.limited && retryCountdown > 0 && (
            <p className="countdown">Please wait {retryCountdown} seconds before trying again.</p>
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>❌ Error:</strong> {error}
          {retryCountdown === 0 && (
            <p className="error-hint">
              💡 Tip: If you're hitting rate limits, try waiting a few minutes between requests.
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="git-branching-animation">
            <svg width="800" height="240" viewBox="0 0 800 240" style={{ transform: `translateX(${Math.max(0, 400 - commits.length * 40)}px)` }}>
              {/* Draw lines between connected commits */}
              {commits.map((commit, idx) => {
                const prevCommit = commits[idx - 1];
                if (!prevCommit) return null;
                
                const lines = [];
                
                // Line from previous commit to this one
                if (commit.branch === prevCommit.branch) {
                  // Same branch - straight line
                  lines.push(
                    <line
                      key={`line-${commit.id}`}
                      className="git-branch"
                      x1={prevCommit.x}
                      y1={prevCommit.y}
                      x2={commit.x}
                      y2={commit.y}
                      stroke={commit.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{ 
                        animationDelay: '0s',
                        animationDuration: '0.3s'
                      }}
                    />
                  );
                } else if (commit.branchFrom !== undefined) {
                  // Branching off - line from main to branch
                  lines.push(
                    <line
                      key={`branch-${commit.id}`}
                      className="git-branch"
                      x1={prevCommit.x}
                      y1={commit.branchFrom}
                      x2={commit.x}
                      y2={commit.y}
                      stroke={commit.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{ 
                        animationDelay: '0s',
                        animationDuration: '0.3s'
                      }}
                    />
                  );
                } else if (commit.mergeFrom !== undefined) {
                  // Merging back - line from branch to main
                  lines.push(
                    <line
                      key={`merge-${commit.id}`}
                      className="git-branch"
                      x1={prevCommit.x}
                      y1={commit.mergeFrom}
                      x2={commit.x}
                      y2={commit.y}
                      stroke={commit.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{ 
                        animationDelay: '0s',
                        animationDuration: '0.3s'
                      }}
                    />
                  );
                }
                
                return lines;
              })}
              
              {/* Draw commit nodes */}
              {commits.map((commit) => (
                <circle
                  key={`node-${commit.id}`}
                  className="git-node"
                  cx={commit.x}
                  cy={commit.y}
                  r="7"
                  fill={commit.color}
                  stroke={commit.color}
                  strokeWidth="2"
                  style={{ 
                    animationDelay: '0s',
                    animationDuration: '0.3s'
                  }}
                />
              ))}
            </svg>
          </div>
          <p>Fetching repository data...</p>
          <p className="loading-subtext">This may take a moment for large repositories</p>
        </div>
      )}

      {data && !loading && (
        <div className="results">
          {cachedResult && (
            <div className="cache-notice">
              ⚡ Results loaded from cache • Updated within the last 5 minutes
            </div>
          )}

          <div className="repo-header">
            <h2>
              <a href={data.repository.url} target="_blank" rel="noopener noreferrer">
                {data.repository.name}
              </a>
            </h2>
            {data.repository.description && (
              <p className="repo-description">{data.repository.description}</p>
            )}
            <div className="repo-stats">
              <span>⭐ {formatNumber(data.repository.stars)} stars</span>
              <span>🔄 {formatNumber(data.repository.forks)} forks</span>
              <span>📝 {formatNumber(data.repository.openIssues)} open issues</span>
              {data.repository.language && (
                <span>💻 {data.repository.language}</span>
              )}
            </div>
          </div>

          <div className="summary-card">
            <h3>📊 Summary</h3>
            <p className="summary-text">{data.summary}</p>
            <div className="summary-stats">
              <div className="stat">
                <div className="stat-value">{formatNumber(data.stats.totalCommits)}</div>
                <div className="stat-label">Commits</div>
              </div>
              <div className="stat">
                <div className="stat-value">{formatNumber(data.stats.totalContributors)}</div>
                <div className="stat-label">Contributors</div>
              </div>
              <div className="stat">
                <div className="stat-value">{formatNumber(data.stats.totalPRs)}</div>
                <div className="stat-label">Merged PRs</div>
              </div>
            </div>
          </div>

          {data.executiveSummary && (
            <div className="executive-summary-card">
              <h3>Summary</h3>
              <p className="executive-summary-text">{data.executiveSummary}</p>
              <div className="executive-summary-footer">
                Generated by analyzing code changes
              </div>
            </div>
          )}

          <div className="charts-grid">
            <div className="chart-card">
              <h3>📈 Work Categories</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={getCategoryChartData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getCategoryChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>👥 Top Contributors</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getContributorChartData()}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="commits" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {data.stats.topAreas && data.stats.topAreas.length > 0 && (
            <div className="areas-card">
              <h3>🎯 Active Areas</h3>
              <div className="areas-list">
                {data.stats.topAreas.map((area, index) => (
                  <span key={index} className="area-tag">{area}</span>
                ))}
              </div>
            </div>
          )}

          <div className="details-grid">
            <div className="detail-card">
              <h3>📝 Recent Commits</h3>
              <div className="commits-list">
                {data.recentCommits.map((commit, index) => (
                  <div key={index} className="commit-item">
                    <a href={commit.url} target="_blank" rel="noopener noreferrer" className="commit-sha">
                      {commit.sha}
                    </a>
                    <p className="commit-message">{commit.message}</p>
                    <div className="commit-meta">
                      <span>{commit.author}</span>
                      <span>{new Date(commit.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {data.recentPRs && data.recentPRs.length > 0 && (
              <div className="detail-card">
                <h3>🔀 Recent Merged PRs</h3>
                <div className="prs-list">
                  {data.recentPRs.map((pr, index) => (
                    <div key={index} className="pr-item">
                      <a href={pr.url} target="_blank" rel="noopener noreferrer" className="pr-number">
                        #{pr.number}
                      </a>
                      <p className="pr-title">{pr.title}</p>
                      <div className="pr-meta">
                        <span>{pr.author}</span>
                        <span>{new Date(pr.mergedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
