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
    <div className="app">
      <div className="header">
        <h1>🔍 Git Repository Analyzer</h1>
        <p>Visualize repository activity and contributions</p>
      </div>

      <form onSubmit={handleSubmit} className="search-form">
        <div className="form-group">
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="Enter GitHub repository URL (e.g., https://github.com/facebook/react)"
            className="repo-input"
            disabled={loading || retryCountdown > 0}
          />
        </div>

        <div className="form-row">
          <select 
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

          <button 
            type="submit" 
            disabled={loading || retryCountdown > 0}
            className="analyze-btn"
          >
            {loading ? '⏳ Analyzing...' : retryCountdown > 0 ? `⏰ Wait ${retryCountdown}s` : '🚀 Analyze'}
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
          <div className="spinner"></div>
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
