import React, { useState } from 'react';

const GitContributorAnalyzer = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [timeRange, setTimeRange] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoUrl, timeRange })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze repository');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getBranchColor = (branchName) => {
    if (branchName.includes('feature')) return '#2D6A4F';
    if (branchName.includes('bugfix') || branchName.includes('fix')) return '#C9184A';
    if (branchName.includes('refactor')) return '#7209B7';
    if (branchName.includes('hotfix')) return '#D00000';
    if (branchName.includes('develop') || branchName.includes('dev')) return '#0077B6';
    if (branchName.includes('main') || branchName.includes('master')) return '#1A1A1A';
    return '#415A77';
  };

  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF9F6',
      padding: '40px 20px',
      fontFamily: '"IBM Plex Mono", "Courier New", monospace'
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Literata:wght@300;400;600;700&display=swap" rel="stylesheet" />
      
      {/* Header */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 40px',
        borderBottom: '3px solid #1A1A1A',
        paddingBottom: '24px'
      }}>
        <h1 style={{
          margin: '0 0 12px',
          fontSize: '48px',
          fontWeight: '600',
          color: '#1A1A1A',
          fontFamily: '"Literata", Georgia, serif',
          letterSpacing: '-1px'
        }}>
          Git Repository Analyzer
        </h1>
        <p style={{
          margin: 0,
          fontSize: '15px',
          color: '#666',
          fontWeight: '400',
          letterSpacing: '0.5px'
        }}>
          ANALYZE ANY GIT REPOSITORY — SEE WHO'S WORKING ON WHAT
        </p>
      </div>

      {/* Input Section */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 40px',
        background: '#FFFFFF',
        border: '2px solid #E8E8E8',
        padding: '32px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#1A1A1A',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              Repository URL
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repository.git"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                border: '2px solid #E8E8E8',
                background: '#FAFAFA',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1A1A1A'}
              onBlur={(e) => e.target.style.borderColor = '#E8E8E8'}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#1A1A1A',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              style={{
                padding: '14px 40px 14px 14px',
                fontSize: '15px',
                border: '2px solid #E8E8E8',
                background: '#FAFAFA',
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
            background: '#1A1A1A',
            color: '#FAF9F6',
            border: 'none',
            padding: '14px 32px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.5px',
            transition: 'all 0.2s',
            opacity: loading ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.target.style.background = '#333';
              e.target.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#1A1A1A';
            e.target.style.transform = 'translateY(0)';
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
            fontSize: '14px'
          }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Results */}
      {data && (
        <>
          {/* Summary Stats */}
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto 40px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div style={{
              background: '#1A1A1A',
              color: '#FAF9F6',
              padding: '24px',
              border: '3px solid #1A1A1A'
            }}>
              <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px' }}>
                {data.contributors.length}
              </div>
              <div style={{ fontSize: '13px', letterSpacing: '1px', opacity: 0.8 }}>
                CONTRIBUTORS
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '2px solid #E8E8E8',
              padding: '24px'
            }}>
              <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px', color: '#1A1A1A' }}>
                {formatNumber(data.totalCommits)}
              </div>
              <div style={{ fontSize: '13px', letterSpacing: '1px', color: '#666' }}>
                TOTAL COMMITS
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '2px solid #E8E8E8',
              padding: '24px'
            }}>
              <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px', color: '#1A1A1A' }}>
                {data.timeRange}
              </div>
              <div style={{ fontSize: '13px', letterSpacing: '1px', color: '#666' }}>
                TIME PERIOD
              </div>
            </div>
          </div>

          {/* Contributors */}
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px'
          }}>
            {data.contributors.map((contributor, idx) => (
              <div
                key={idx}
                style={{
                  background: '#FFFFFF',
                  border: '2px solid #E8E8E8',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  animation: `fadeIn 0.4s ease-out ${idx * 0.08}s both`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(8px)';
                  e.currentTarget.style.borderColor = '#1A1A1A';
                  e.currentTarget.style.boxShadow = '-8px 8px 0 #1A1A1A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.borderColor = '#E8E8E8';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Contributor Header */}
                <div style={{
                  padding: '28px 32px',
                  background: '#F5F5F5',
                  borderBottom: '2px solid #E8E8E8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: '#1A1A1A',
                    color: '#FAF9F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    fontWeight: '600',
                    border: '3px solid #1A1A1A',
                    flexShrink: 0
                  }}>
                    {getInitials(contributor.name)}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <h2 style={{
                      margin: '0 0 6px',
                      fontSize: '24px',
                      fontWeight: '600',
                      color: '#1A1A1A',
                      fontFamily: '"Literata", Georgia, serif'
                    }}>
                      {contributor.name}
                    </h2>
                    <p style={{
                      margin: 0,
                      fontSize: '13px',
                      color: '#666',
                      letterSpacing: '0.3px'
                    }}>
                      {contributor.email}
                    </p>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{
                      background: '#1A1A1A',
                      color: '#FAF9F6',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: '500',
                      letterSpacing: '0.5px'
                    }}>
                      {contributor.commits} COMMITS
                    </div>
                    <div style={{
                      background: '#2D6A4F',
                      color: '#FAF9F6',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: '500',
                      letterSpacing: '0.5px'
                    }}>
                      +{formatNumber(contributor.additions)}
                    </div>
                    <div style={{
                      background: '#C9184A',
                      color: '#FAF9F6',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: '500',
                      letterSpacing: '0.5px'
                    }}>
                      -{formatNumber(contributor.deletions)}
                    </div>
                  </div>
                </div>

                {/* Branches */}
                {contributor.branches.length > 0 && (
                  <div style={{ padding: '24px 32px 32px' }}>
                    <h3 style={{
                      margin: '0 0 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1A1A1A',
                      letterSpacing: '1px',
                      textTransform: 'uppercase'
                    }}>
                      Branches ({contributor.branches.length})
                    </h3>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      {contributor.branches.map((branch, branchIdx) => (
                        <div
                          key={branchIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '14px 16px',
                            background: '#FAFAFA',
                            border: '1px solid #E8E8E8',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#F5F5F5';
                            e.currentTarget.style.borderColor = getBranchColor(branch.name);
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#FAFAFA';
                            e.currentTarget.style.borderColor = '#E8E8E8';
                          }}
                        >
                          <div style={{
                            width: '6px',
                            height: '32px',
                            background: getBranchColor(branch.name),
                            flexShrink: 0
                          }} />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '500',
                              color: '#1A1A1A',
                              marginBottom: '4px',
                              wordBreak: 'break-all'
                            }}>
                              {branch.name}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#999',
                              letterSpacing: '0.3px'
                            }}>
                              Last updated {branch.lastUpdate}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default GitContributorAnalyzer;