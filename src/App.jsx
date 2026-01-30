import { useState } from 'react';
import './App.css';

function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [timeRange, setTimeRange] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  const colors = darkMode ? {
    bg: '#1A1A1A', text: '#E8E8E8', cardBg: '#2D2D2D', cardBorder: '#404040',
    primary: '#0088FF', inputBg: '#2D2D2D', inputBorder: '#404040',
    buttonBg: '#0077B6', buttonText: '#FFFFFF'
  } : {
    bg: '#FAF9F6', text: '#1A1A1A', cardBg: '#FFFFFF', cardBorder: '#E8E8E8',
    primary: '#0077B6', inputBg: '#FFFFFF', inputBorder: '#D4D4D4',
    buttonBg: '#0077B6', buttonText: '#FFFFFF'
  };

  const handleAnalyze = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, timeRange })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Analysis failed');
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, padding: '40px 20px', transition: 'all 0.3s ease' }}>
      <button onClick={() => setDarkMode(!darkMode)} style={{ position: 'fixed', top: '20px', right: '20px', background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px', color: colors.text }}>
        {darkMode ? '☀️ Light' : '🌙 Dark'}
      </button>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '800', margin: '0 0 16px 0', fontFamily: 'Literata, serif', background: 'linear-gradient(135deg, #0077B6 0%, #00B4D8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Git Repository Analyzer
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.7 }}>Get intelligent insights into your repository's activity</p>
        </div>

        <div style={{ background: colors.cardBg, padding: '32px', borderRadius: '12px', marginBottom: '40px', border: `1px solid ${colors.cardBorder}` }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Repository URL</label>
            <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()} style={{ width: '100%', padding: '12px 16px', fontSize: '16px', borderRadius: '8px', border: `1px solid ${colors.inputBorder}`, background: colors.inputBg, color: colors.text, boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Time Range</label>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} style={{ width: '100%', padding: '12px 16px', fontSize: '16px', borderRadius: '8px', border: `1px solid ${colors.inputBorder}`, background: colors.inputBg, color: colors.text, boxSizing: 'border-box', cursor: 'pointer' }}>
              <option value="day">Last 24 Hours</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
              <option value="6months">Last 6 Months</option>
              <option value="year">Last Year</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <button onClick={handleAnalyze} disabled={loading} style={{ width: '100%', padding: '14px 24px', fontSize: '16px', fontWeight: '600', color: colors.buttonText, background: loading ? '#999' : colors.buttonBg, border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Analyzing...' : 'Analyze Repository'}
          </button>

          {error && <div style={{ marginTop: '16px', padding: '12px 16px', background: '#FEE', color: '#C00', borderRadius: '6px', fontSize: '14px' }}>{error}</div>}
        </div>

        {data && (
          <>
            <div style={{ background: colors.cardBg, padding: '24px 32px', marginBottom: '24px', borderRadius: '8px', border: `1px solid ${colors.cardBorder}` }}>
              <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '8px' }}>Repository Analysis</div>
              <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>{repoUrl}</div>
              <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: '12px', opacity: 0.6 }}>Time Range</div><div style={{ fontSize: '16px', fontWeight: '500' }}>{data.timeRange}</div></div>
                <div><div style={{ fontSize: '12px', opacity: 0.6 }}>Commits</div><div style={{ fontSize: '16px', fontWeight: '500' }}>{data.totalCommits}</div></div>
                <div><div style={{ fontSize: '12px', opacity: 0.6 }}>Contributors</div><div style={{ fontSize: '16px', fontWeight: '500' }}>{data.contributors.length}</div></div>
                <div><div style={{ fontSize: '12px', opacity: 0.6 }}>Primary Branch</div><div style={{ fontSize: '16px', fontWeight: '500' }}>{data.primaryBranch}</div></div>
              </div>
            </div>

            <div style={{ background: darkMode ? '#1E3A4F' : '#F0F8FF', border: `3px solid ${darkMode ? '#2E5A7F' : '#0077B6'}`, borderRadius: '12px', padding: '32px 40px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <span style={{ fontSize: '28px' }}>📊</span>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: darkMode ? '#E8E8E8' : '#0077B6', fontFamily: 'Literata, serif' }}>Activity Summary</h2>
              </div>
              <div style={{ fontSize: '17px', lineHeight: '1.8' }}>{data.activitySummary}</div>
            </div>

            {data.contributors && data.contributors.length > 0 && (
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '8px', padding: '24px 32px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', fontFamily: 'Literata, serif' }}>Top Contributors</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.contributors.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: darkMode ? '#2D2D2D' : '#F9F9F9', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: colors.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px' }}>{i + 1}</div>
                        <div>
                          <div style={{ fontWeight: '500' }}>{c.name}</div>
                          <div style={{ fontSize: '12px', opacity: 0.6 }}>{c.email}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: colors.primary }}>{c.commits} commits</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
