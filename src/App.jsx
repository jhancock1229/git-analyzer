import { useState } from 'react';
import { InfoModal, DiagramModal, SortableListModal } from './components/Modal';
import BranchDiagram from './components/BranchDiagram';

function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [timeRange, setTimeRange] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [repoInfo, setRepoInfo] = useState(null);
  const [showStaleBranches, setShowStaleBranches] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const timeRanges = [
    { value: 'day', label: 'Last 24 Hours' },
    { value: 'week', label: 'Last Week' },
    { value: 'month', label: 'Last Month' },
    { value: 'quarter', label: 'Last Quarter' },
    { value: '6months', label: 'Last 6 Months' },
    { value: 'year', label: 'Last Year' },
    { value: 'all', label: 'All Time' }
  ];

  const analyzeRepository = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, timeRange })
      });
      
      if (!response.ok) throw new Error('Failed to analyze');
      
      const result = await response.json();
      
      // Extract owner/repo from URL
      const match = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
      if (match) {
        const info = { owner: match[1], repo: match[2] };
        setRepoInfo(info);
        window.repoInfo = info;
      }
      
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderModal = () => {
    if (!showModal) return null;

    console.log('Rendering modal with type:', showModal.type, showModal); // Debug log

    if (showModal.type === 'info') {
      return (
        <InfoModal
          title={showModal.title}
          explanation={showModal.explanation}
          criteria={showModal.criteria}
          onClose={() => setShowModal(null)}
        />
      );
    }

    if (showModal.type === 'diagram') {
      console.log('Rendering DiagramModal with commits:', showModal.data?.length); // Debug log
      return (
        <DiagramModal
          title={showModal.title}
          commits={showModal.data}
          primaryBranch={showModal.primaryBranch}
          onClose={() => setShowModal(null)}
        />
      );
    }

    // Default to SortableListModal for other types
    return (
      <SortableListModal darkMode={darkMode}
        title={showModal.title}
        items={showModal.data}
        onClose={() => setShowModal(null)}
      />
    );
  };

  const colors = darkMode ? {
    bg: '#1A1A1A',
    text: '#E8E8E8',
    cardBg: '#2D2D2D',
    cardBorder: '#404040',
    inputBg: '#2D2D2D',
    inputBorder: '#404040',
    buttonBg: '#E8E8E8',
    buttonText: '#1A1A1A',
    primary: '#0077B6',
    infoBg: '#1E3A4F',
    infoBorder: '#2E5A7F',
    headerBg: '#0A0A0A',
    modalBg: '#2D2D2D',
    headerText: '#E8E8E8'
  } : {
    bg: '#FAF9F6',
    text: '#1A1A1A',
    cardBg: '#FFFFFF',
    cardBorder: '#E8E8E8',
    inputBg: '#FFFFFF',
    inputBorder: '#E8E8E8',
    buttonBg: '#1A1A1A',
    buttonText: '#FAF9F6',
    primary: '#0077B6',
    infoBg: '#F0F8FF',
    infoBorder: '#0077B6',
    headerBg: '#1A1A1A',
    modalBg: '#FFFFFF',
    headerText: '#FAF9F6'
  };

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px', background: colors.bg, transition: 'background-color 0.3s ease' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative' }}>
        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            position: 'absolute',
            top: '0',
            right: '0',
            background: 'transparent',
            border: `2px solid ${colors.text}`,
            color: colors.text,
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'IBM Plex Mono, monospace',
            transition: 'all 0.2s',
            zIndex: 1000
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.text;
            e.currentTarget.style.color = colors.bg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = colors.text;
          }}
        >
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
        
        {/* Header */}
        <div style={{ marginBottom: '40px', borderBottom: `3px solid ${colors.text}`, paddingBottom: '24px' }}>
          <h1 style={{ 
            margin: '0 0 12px', 
            fontSize: '48px', 
            fontWeight: '600', 
            fontFamily: 'Literata, serif',
            letterSpacing: '-1px',
            color: colors.text
          }}>
            Git Repository Analyzer
          </h1>
          <p style={{ margin: 0, fontSize: '15px', color: colors.text, letterSpacing: '0.5px' }}>
            ANALYZE ANY GIT REPOSITORY — SEE WHO'S WORKING ON WHAT
          </p>
        </div>

        {/* Input Section */}
        <div style={{ 
          background: colors.cardBg, 
          border: `2px solid ${colors.cardBorder}`, 
          padding: '32px', 
          marginBottom: '40px',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '13px', 
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                style={{ 
                  width: '100%', 
                  padding: '14px', 
                  fontSize: '15px', 
                  border: `2px solid ${colors.cardBorder}`,
                  background: colors.inputBg,
                  color: colors.text,
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = colors.primary}
                onBlur={(e) => e.target.style.borderColor = colors.cardBorder}
              />
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '13px', 
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                style={{ 
                  padding: '14px 40px 14px 14px', 
                  fontSize: '15px', 
                  border: `2px solid ${colors.cardBorder}`,
                  background: colors.inputBg,
                  color: colors.text,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  outline: 'none',
                  minWidth: '200px'
                }}
              >
                {timeRanges.map(range => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={analyzeRepository}
            disabled={loading}
            style={{ 
              background: colors.buttonBg, 
              color: colors.buttonText, 
              border: 'none',
              padding: '14px 32px', 
              fontSize: '15px', 
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '0.5px',
              transition: 'all 0.2s',
              opacity: loading ? 0.6 : 1,
              borderRadius: '6px'
            }}
          >
            {loading ? 'ANALYZING...' : 'ANALYZE REPOSITORY'}
          </button>

          {error && (
            <div style={{ 
              marginTop: '16px', 
              padding: '16px', 
              background: '#FFE5E5',
              border: '2px solid #C9184A', 
              color: '#8B0000',
              fontSize: '14px',
              borderRadius: '6px'
            }}>
              Error: {error}
            </div>
          )}
        </div>

        {/* Results */}
        {data && (
          <>
            {/* Primary Branch Info */}
            <a
              href={data.primaryBranchUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ 
                background: colors.buttonBg, 
                color: colors.buttonText, 
                padding: '28px 32px',
                marginBottom: '40px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                border: '2px solid transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
                e.currentTarget.style.borderColor = colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <div>
                <div style={{ fontSize: '14px', letterSpacing: '1px', opacity: 0.7, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Primary Branch
                </div>
                <div style={{ fontSize: '32px', fontWeight: '700', fontFamily: 'Literata, serif' }}>
                  {data.primaryBranch}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '4px' }}>
                  🔗 Click to view on GitHub
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', letterSpacing: '1px', opacity: 0.7, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Merges to {data.primaryBranch}
                </div>
                <div style={{ fontSize: '32px', fontWeight: '700' }}>
                  {data.merges ? data.merges.length : 0}
                </div>
              </div>
            </a>

            {/* Activity Summary */}
            {data.activitySummary && (
              <div style={{
                background: '#F0F8FF',
                border: '2px solid #0077B6',
                borderRadius: '8px',
                padding: '24px 32px',
                marginBottom: '40px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <span style={{ fontSize: '24px' }}>📊</span>
                  <h3 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#0077B6',
                    fontFamily: 'Literata, serif'
                  }}>
                    Activity Summary
                  </h3>
                </div>
                <div style={{
                  margin: 0,
                  fontSize: '15px',
                  lineHeight: '1.8',
                  color: '#333',
                  fontFamily: 'IBM Plex Mono',
                  whiteSpace: 'pre-wrap'
                }}>
                  {data.activitySummary.split('\n').map((line, idx) => {
                    // Handle bold markdown (**text**)
                    if (line.includes('**')) {
                      const parts = line.split(/\*\*(.*?)\*\*/g);
                      return (
                        <div key={idx} style={{ marginBottom: line.startsWith('   ') ? '4px' : '12px' }}>
                          {parts.map((part, i) => 
                            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                          )}
                        </div>
                      );
                    }
                    return <div key={idx} style={{ marginBottom: line.startsWith('   ') ? '4px' : '12px' }}>{line || '\u00A0'}</div>;
                  })}
                </div>
              </div>
            )}

            {/* Most Recent Commit Details */}
            {data.recentCommitAnalysis && (
              <div style={{
                background: colors.cardBg,
                border: `2px solid ${colors.cardBorder}`,
                borderRadius: '8px',
                padding: '24px 32px',
                marginBottom: '40px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '24px' }}>🔄</span>
                  <h3 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '600',
                    color: colors.text,
                    fontFamily: 'Literata, serif'
                  }}>
                    Most Recent Change
                  </h3>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: colors.text,
                    marginBottom: '8px'
                  }}>
                    {data.recentCommitAnalysis.humanDescription}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: colors.text,
                    opacity: 0.7,
                    marginBottom: '12px'
                  }}>
                    by {data.recentCommitAnalysis.author} • {new Date(data.recentCommitAnalysis.date).toLocaleString()}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    padding: '12px',
                    background: darkMode ? '#1E3A4F' : '#E6F3FF',
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#00AA00' }}>
                      +{data.recentCommitAnalysis.additions}
                    </div>
                    <div style={{ fontSize: '12px', color: colors.text, opacity: 0.7 }}>
                      additions
                    </div>
                  </div>
                  <div style={{
                    padding: '12px',
                    background: darkMode ? '#1E3A4F' : '#E6F3FF',
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#DD0000' }}>
                      -{data.recentCommitAnalysis.deletions}
                    </div>
                    <div style={{ fontSize: '12px', color: colors.text, opacity: 0.7 }}>
                      deletions
                    </div>
                  </div>
                  <div style={{
                    padding: '12px',
                    background: darkMode ? '#1E3A4F' : '#E6F3FF',
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>
                      {data.recentCommitAnalysis.filesChanged}
                    </div>
                    <div style={{ fontSize: '12px', color: colors.text, opacity: 0.7 }}>
                      files changed
                    </div>
                  </div>
                </div>

                {data.recentCommitAnalysis.changes.length > 0 && (
                  <details style={{ marginTop: '16px' }}>
                    <summary style={{
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: colors.text,
                      padding: '8px 0'
                    }}>
                      View changed files ({data.recentCommitAnalysis.changes.length})
                    </summary>
                    <div style={{
                      marginTop: '12px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      fontSize: '13px',
                      fontFamily: 'IBM Plex Mono, monospace'
                    }}>
                      {data.recentCommitAnalysis.changes.map((change, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '8px',
                            marginBottom: '4px',
                            background: darkMode ? '#2D2D2D' : '#F5F5F5',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ color: colors.text }}>
                            {change.status === 'added' && '✅ '}
                            {change.status === 'removed' && '❌ '}
                            {change.status === 'modified' && '✏️ '}
                            {change.filename}
                          </span>
                          <span style={{ color: colors.text, opacity: 0.6, fontSize: '12px' }}>
                            <span style={{ color: '#00AA00' }}>+{change.additions}</span>
                            {' '}
                            <span style={{ color: '#DD0000' }}>-{change.deletions}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* CI/CD & Engineering Tools */}
            {data.cicdTools && (
              <div style={{
                background: colors.cardBg,
                border: `2px solid ${colors.cardBorder}`,
                borderRadius: '8px',
                padding: '32px',
                marginBottom: '40px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  <span style={{ fontSize: '24px' }}>🔧</span>
                  <h3 style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: '600',
                    color: colors.text,
                    fontFamily: 'Literata, serif'
                  }}>
                    Engineering Practices
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  {/* CI/CD */}
                  {data.cicdTools.cicd.length > 0 && data.cicdTools.cicd.map((tool, idx) => (
                    <a
                      key={idx}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '16px',
                        background: darkMode ? '#1E3A4F' : '#E6F3FF',
                        borderRadius: '6px',
                        border: `1px solid ${darkMode ? '#2E5A7F' : '#0077B6'}`,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '8px', color: colors.text, fontSize: '14px' }}>
                        ⚙️ CI/CD Pipeline
                      </div>
                      <div style={{ fontSize: '13px', color: colors.text, opacity: 0.8 }}>
                        {tool.name}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.text, opacity: 0.6, marginTop: '4px' }}>
                        📁 {tool.path}
                      </div>
                    </a>
                  ))}

                  {/* Containers */}
                  {data.cicdTools.containers.length > 0 && data.cicdTools.containers.map((container, idx) => (
                    <a
                      key={idx}
                      href={container.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '16px',
                        background: darkMode ? '#1E3A4F' : '#E6F3FF',
                        borderRadius: '6px',
                        border: `1px solid ${darkMode ? '#2E5A7F' : '#0077B6'}`,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '8px', color: colors.text, fontSize: '14px' }}>
                        🐳 Containerization
                      </div>
                      <div style={{ fontSize: '13px', color: colors.text, opacity: 0.8 }}>
                        {container.name}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.text, opacity: 0.6, marginTop: '4px' }}>
                        📁 {container.path}
                      </div>
                    </a>
                  ))}

                  {/* Testing */}
                  {data.cicdTools.testing.length > 0 && data.cicdTools.testing.map((test, idx) => (
                    <a
                      key={idx}
                      href={test.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '16px',
                        background: darkMode ? '#1E3A4F' : '#E6F3FF',
                        borderRadius: '6px',
                        border: `1px solid ${darkMode ? '#2E5A7F' : '#0077B6'}`,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '8px', color: colors.text, fontSize: '14px' }}>
                        ✅ Testing
                      </div>
                      <div style={{ fontSize: '13px', color: colors.text, opacity: 0.8 }}>
                        {test.framework}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.text, opacity: 0.6, marginTop: '4px' }}>
                        📁 {test.file}
                      </div>
                    </a>
                  ))}

                  {/* Coverage */}
                  {data.cicdTools.coverage.length > 0 && data.cicdTools.coverage.map((cov, idx) => (
                    <a
                      key={idx}
                      href={cov.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '16px',
                        background: darkMode ? '#1E3A4F' : '#E6F3FF',
                        borderRadius: '6px',
                        border: `1px solid ${darkMode ? '#2E5A7F' : '#0077B6'}`,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '8px', color: colors.text, fontSize: '14px' }}>
                        📊 Code Coverage
                      </div>
                      <div style={{ fontSize: '13px', color: colors.text, opacity: 0.8 }}>
                        {cov.name}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.text, opacity: 0.6, marginTop: '4px' }}>
                        📁 {cov.path}
                      </div>
                    </a>
                  ))}

                  {/* Linting */}
                  {data.cicdTools.linting.length > 0 && data.cicdTools.linting.map((lint, idx) => (
                    <a
                      key={idx}
                      href={lint.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '16px',
                        background: darkMode ? '#1E3A4F' : '#E6F3FF',
                        borderRadius: '6px',
                        border: `1px solid ${darkMode ? '#2E5A7F' : '#0077B6'}`,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '8px', color: colors.text, fontSize: '14px' }}>
                        🔍 Code Linting
                      </div>
                      <div style={{ fontSize: '13px', color: colors.text, opacity: 0.8 }}>
                        {lint.name}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.text, opacity: 0.6, marginTop: '4px' }}>
                        📁 {lint.path}
                      </div>
                    </a>
                  ))}

                  {/* Security */}
                  {data.cicdTools.security.length > 0 && data.cicdTools.security.map((sec, idx) => (
                    <a
                      key={idx}
                      href={sec.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '16px',
                        background: darkMode ? '#1E3A4F' : '#E6F3FF',
                        borderRadius: '6px',
                        border: `1px solid ${darkMode ? '#2E5A7F' : '#0077B6'}`,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '8px', color: colors.text, fontSize: '14px' }}>
                        🔒 Security Scanning
                      </div>
                      <div style={{ fontSize: '13px', color: colors.text, opacity: 0.8 }}>
                        {sec.name}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.text, opacity: 0.6, marginTop: '4px' }}>
                        📁 {sec.path}
                      </div>
                    </a>
                  ))}
                </div>

                {/* No tools detected message */}
                {data.cicdTools.cicd.length === 0 && 
                 data.cicdTools.containers.length === 0 && 
                 data.cicdTools.testing.length === 0 && 
                 data.cicdTools.coverage.length === 0 && 
                 data.cicdTools.linting.length === 0 && 
                 data.cicdTools.security.length === 0 && (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: colors.text,
                    opacity: 0.6,
                    fontSize: '14px'
                  }}>
                    No CI/CD or automated tooling detected
                  </div>
                )}
              </div>
            )}

            {/* Branching Strategy Analysis */}
            {data.branchingAnalysis && (
              <div style={{ 
                background: colors.cardBg, 
                border: `2px solid ${colors.cardBorder}`, 
                padding: '32px',
                marginBottom: '40px',
                borderRadius: '8px'
              }}>
                <h3 style={{ 
                  margin: '0 0 24px', 
                  fontSize: '20px', 
                  fontWeight: '600',
                  fontFamily: 'Literata, serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '24px' }}>🔀</span>
                  Branching Analysis
                </h3>

                {/* Detection Logic Explanation */}
                <div style={{
                  background: '#F0F8FF',
                  border: '2px solid #0077B6',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '24px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#0077B6' }}>
                    🔍 How We Detect Branching Patterns
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#333' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Branch Name Matching:</strong> We analyze branch names for keywords:
                    </div>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      <li><code style={{ background: '#E8E8E8', padding: '2px 6px', borderRadius: '3px' }}>feature</code> → Feature branches</li>
                      <li><code style={{ background: '#E8E8E8', padding: '2px 6px', borderRadius: '3px' }}>fix</code>, <code style={{ background: '#E8E8E8', padding: '2px 6px', borderRadius: '3px' }}>bugfix</code> → Bugfix branches</li>
                      <li><code style={{ background: '#E8E8E8', padding: '2px 6px', borderRadius: '3px' }}>hotfix</code> → Hotfix branches</li>
                      <li><code style={{ background: '#E8E8E8', padding: '2px 6px', borderRadius: '3px' }}>develop</code>, <code style={{ background: '#E8E8E8', padding: '2px 6px', borderRadius: '3px' }}>dev</code> → Development branches</li>
                      <li><code style={{ background: '#E8E8E8', padding: '2px 6px', borderRadius: '3px' }}>release</code> → Release branches</li>
                    </ul>
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #0077B6' }}>
                      <strong>Strategy Detection:</strong>
                    </div>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      <li><strong>Git Flow:</strong> Has <code style={{ background: '#E8E8E8', padding: '2px 6px', borderRadius: '3px' }}>develop</code> branch + (feature or release branches)</li>
                      <li><strong>GitHub Flow:</strong> Has 4+ feature branches, no develop branch</li>
                      <li><strong>Trunk-Based:</strong> 3 or fewer total branches</li>
                      <li><strong>Custom:</strong> Doesn't match standard patterns</li>
                    </ul>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div 
                    onClick={() => setShowModal({ 
                      type: 'info',
                      title: data.branchingAnalysis.strategy,
                      explanation: data.branchingAnalysis.strategyExplanation
                    })}
                    style={{ 
                      background: '#F5F5F5', 
                      padding: '20px', 
                      borderRadius: '8px',
                      borderLeft: '4px solid #1A1A1A',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#E8E8E8';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#F5F5F5';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ fontSize: '12px', color: colors.text, marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>
                      Strategy
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: colors.text }}>
                      {data.branchingAnalysis.strategy}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      Click for details
                    </div>
                  </div>

                  <div 
                    onClick={() => setShowModal({ 
                      type: 'info',
                      title: data.branchingAnalysis.workflow,
                      explanation: data.branchingAnalysis.workflowExplanation,
                      criteria: data.branchingAnalysis.detectionCriteria
                    })}
                    style={{ 
                      background: '#F5F5F5', 
                      padding: '20px', 
                      borderRadius: '8px',
                      borderLeft: '4px solid #7209B7',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#E8E8E8';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#F5F5F5';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ fontSize: '12px', color: colors.text, marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>
                      Workflow
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: colors.text }}>
                      {data.branchingAnalysis.workflow}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      Click for details
                    </div>
                  </div>
                </div>

                {data.branchingAnalysis.patterns.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {data.branchingAnalysis.patterns.map((p, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          // Filter branches by type
                          const patternType = p.type.toLowerCase();
                          let filteredBranches = [];
                          
                          if (patternType.includes('feature')) {
                            filteredBranches = data.branches.filter(b => b.name.includes('feature'));
                          } else if (patternType.includes('bugfix')) {
                            filteredBranches = data.branches.filter(b => b.name.includes('bugfix') || b.name.includes('fix'));
                          } else if (patternType.includes('hotfix')) {
                            filteredBranches = data.branches.filter(b => b.name.includes('hotfix'));
                          } else if (patternType.includes('development')) {
                            filteredBranches = data.branches.filter(b => b.name.includes('develop') || b.name.includes('dev'));
                          } else if (patternType.includes('release')) {
                            filteredBranches = data.branches.filter(b => b.name.includes('release'));
                          }
                          
                          if (filteredBranches.length > 0) {
                            setShowModal({
                              type: 'branches',
                              data: filteredBranches,
                              title: `${p.type} (${filteredBranches.length})`
                            });
                          }
                        }}
                        style={{ 
                          background: '#FAFAFA', 
                          border: '1px solid #E8E8E8',
                          padding: '16px',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#E8E8E8';
                          e.currentTarget.style.borderColor = '#1A1A1A';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#FAFAFA';
                          e.currentTarget.style.borderColor = '#E8E8E8';
                        }}
                      >
                        <span style={{ fontSize: '14px', color: '#333' }}>{p.type}</span>
                        <span style={{ 
                          background: colors.buttonBg, 
                          color: '#fff',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}>
                          {p.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Branch Diagram */}
            {data.graph && data.graph.length > 0 && (
              <div style={{ 
                background: '#fff', 
                border: `2px solid ${colors.cardBorder}`, 
                padding: '32px',
                marginBottom: '40px',
                borderRadius: '8px'
              }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '20px', 
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    🌳 Branch Diagram
                    <span style={{ 
                      fontSize: '13px', 
                      background: '#F5F5F5',
                      color: colors.text,
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      {data.graph.length} commits
                    </span>
                  </h3>
                </div>
                
                <div 
                  onClick={() => setShowModal({
                    type: 'diagram',
                    title: 'Branch Diagram - Full View',
                    data: data.graph,
                    primaryBranch: data.primaryBranch
                  })}
                  style={{ 
                    background: '#FAFAFA', 
                    border: '1px solid #E8E8E8',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    height: '400px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1A1A1A';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E8E8E8';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <BranchDiagram darkMode={darkMode} 
                    commits={data.graph.slice(0, 50)} 
                    primaryBranch={data.primaryBranch}
                    compact={true}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(26, 26, 26, 0.9)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    Click to expand and see all commits
                  </div>
                </div>
                
                <div style={{ 
                  marginTop: '16px', 
                  padding: '12px',
                  background: '#F5F5F5',
                  fontSize: '12px',
                  color: colors.text,
                  borderLeft: '3px solid #1A1A1A',
                  borderRadius: '0 4px 4px 0'
                }}>
                  <strong>How to read:</strong> Each dot is a commit. Main branch runs through center. Lines show branch relationships. Click diagram to expand or click individual commits for details.
                </div>
              </div>
            )}

            {/* Summary Stats */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <div 
                onClick={() => setShowModal({ 
                  type: 'contributors',
                  data: data.contributors,
                  title: `${data.contributors.length} Contributors`
                })}
                style={{ 
                  background: colors.cardBg,
                  border: `2px solid ${colors.cardBorder}`,
                  padding: '24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1A1A1A';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E8E8E8';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px', color: colors.text }}>
                  {data.contributors.length}
                </div>
                <div style={{ fontSize: '13px', letterSpacing: '1px', color: colors.text }}>
                  CONTRIBUTORS
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                  Click to view all
                </div>
              </div>

              <div 
                onClick={() => {
                  const branchesToShow = showStaleBranches && data.staleBranches 
                    ? [...data.branches, ...data.staleBranches]
                    : data.branches;
                  setShowModal({ 
                    type: 'branches',
                    data: branchesToShow,
                    title: `${branchesToShow.length} Branches`
                  });
                }}
                style={{ 
                  background: colors.cardBg,
                  border: `2px solid ${colors.cardBorder}`,
                  padding: '24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1A1A1A';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E8E8E8';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px', color: colors.text }}>
                  {data.totalBranches || 0}
                </div>
                <div style={{ fontSize: '13px', letterSpacing: '1px', color: colors.text }}>
                  ACTIVE BRANCHES
                </div>
                
                {/* Stale branches info */}
                {data.staleBranchesCount > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #E8E8E8' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '11px', color: '#999' }}>
                        {data.staleBranchesCount} stale (90+ days)
                      </span>
                      <label 
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: colors.text
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={showStaleBranches}
                          onChange={(e) => setShowStaleBranches(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        Show
                      </label>
                    </div>
                  </div>
                )}
                
                {(!data.staleBranchesCount || data.staleBranchesCount === 0) && (
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                    No stale branches
                  </div>
                )}
              </div>

              <div 
                onClick={() => setShowModal({ 
                  type: 'commits',
                  data: data.graph,
                  title: `${data.totalCommits.toLocaleString()} Commits`
                })}
                style={{ 
                  background: colors.cardBg,
                  border: `2px solid ${colors.cardBorder}`,
                  padding: '24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1A1A1A';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E8E8E8';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px', color: colors.text }}>
                  {data.totalCommits.toLocaleString()}
                </div>
                <div style={{ fontSize: '13px', letterSpacing: '1px', color: colors.text }}>
                  TOTAL COMMITS
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                  Click to view all
                </div>
              </div>

              <div style={{ 
                background: colors.cardBg,
                border: `2px solid ${colors.cardBorder}`,
                padding: '24px',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: colors.text }}>
                  {data.timeRange}
                </div>
                <div style={{ fontSize: '13px', letterSpacing: '1px', color: colors.text }}>
                  TIME PERIOD
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {renderModal()}
    </div>
  );
}

export default App;
