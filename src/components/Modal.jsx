import { useState } from 'react';
import BranchDiagram from './BranchDiagram';

export function InfoModal({ title, explanation, criteria, onClose }) {
  return (
    <div 
      onClick={onClose}
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        cursor: 'pointer',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          cursor: 'default',
          position: 'relative',
          animation: 'slideIn 0.3s ease-out'
        }}
      >
        <button
          onClick={onClose}
          className="modal-close-btn"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#E8E8E8',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            fontSize: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            fontWeight: '300',
            color: '#666'
          }}
        >
          ×
        </button>

        <div style={{ padding: '40px' }}>
          <h2 style={{
            margin: '0 0 24px',
            fontSize: '32px',
            fontWeight: '700',
            color: '#1A1A1A',
            fontFamily: 'Literata, serif',
            paddingRight: '40px'
          }}>
            {title}
          </h2>
          
          <div style={{
            fontSize: '16px',
            lineHeight: '1.8',
            color: '#333',
            marginBottom: '32px',
            fontFamily: 'IBM Plex Mono'
          }}>
            {explanation}
          </div>
          
          {criteria && criteria.length > 0 && (
            <div>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: '#666',
                marginBottom: '16px'
              }}>
                How We Detected This:
              </h3>
              <div style={{
                background: '#F5F5F5',
                borderRadius: '8px',
                padding: '20px',
                borderLeft: '4px solid #1A1A1A'
              }}>
                {criteria.map((c, i) => (
                  <div 
                    key={i}
                    style={{
                      fontSize: '14px',
                      marginBottom: '12px',
                      paddingLeft: '8px',
                      color: '#333',
                      fontFamily: 'IBM Plex Mono',
                      lineHeight: '1.6'
                    }}
                  >
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div style={{
            marginTop: '32px',
            padding: '16px',
            background: '#F0F0F0',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#666',
            textAlign: 'center'
          }}>
            Click anywhere outside this box to close
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiagramModal({ title, commits, primaryBranch, onClose }) {
  return (
    <div 
      onClick={onClose}
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        cursor: 'pointer',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          maxWidth: '1400px',
          width: '100%',
          height: '90vh',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          cursor: 'default',
          position: 'relative',
          animation: 'slideIn 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ padding: '32px 40px 24px', borderBottom: '2px solid #E8E8E8', flexShrink: 0 }}>
          <button
            onClick={onClose}
            className="modal-close-btn"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: '#E8E8E8',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              fontWeight: '300',
              color: '#666',
              zIndex: 1
            }}
          >
            ×
          </button>
          
          <h2 style={{
            margin: '0',
            fontSize: '28px',
            fontWeight: '700',
            color: '#1A1A1A',
            fontFamily: 'Literata, serif',
            paddingRight: '50px'
          }}>
            {title}
          </h2>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
            Showing {commits.length} commits • Scroll to see full history • Click any commit to open on GitHub
          </div>
        </div>
        
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          background: '#FAFAFA',
          position: 'relative'
        }}>
          <div style={{ 
            minHeight: '100%',
            padding: '40px 20px'
          }}>
            <BranchDiagram 
              commits={commits} 
              primaryBranch={primaryBranch}
              compact={false}
            />
          </div>
        </div>
        
        <div style={{ 
          padding: '16px 40px', 
          borderTop: '2px solid #E8E8E8', 
          background: '#F5F5F5',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '13px', color: '#666', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span><strong>💡 Tips:</strong></span>
            <span>• Click commits to view on GitHub</span>
            <span>• Scroll to see full history</span>
            <span>• Lines show branch relationships</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SortableListModal({ title, items, onClose }) {
  // Determine default sort based on item type
  const getDefaultSort = () => {
    if (!items || items.length === 0) return { by: 'commits', order: 'desc' };
    const firstItem = items[0];
    
    // If it has timestamp (commits), sort by date
    if (firstItem.timestamp !== undefined) {
      return { by: 'timestamp', order: 'desc' };
    }
    // If it has commits (contributors), sort by commits
    if (firstItem.commits !== undefined) {
      return { by: 'commits', order: 'desc' };
    }
    // If it has name only (branches), sort by name
    if (firstItem.name !== undefined && !firstItem.email) {
      return { by: 'name', order: 'asc' };
    }
    
    return { by: 'commits', order: 'desc' };
  };
  
  const defaultSort = getDefaultSort();
  const [sortBy, setSortBy] = useState(defaultSort.by);
  const [sortOrder, setSortOrder] = useState(defaultSort.order);
  
  const getSortOptions = () => {
    if (!items || items.length === 0) return [];
    
    const firstItem = items[0];
    const options = [];
    
    if (firstItem.commits !== undefined) options.push({ value: 'commits', label: 'Commits' });
    if (firstItem.additions !== undefined) options.push({ value: 'additions', label: 'Additions' });
    if (firstItem.deletions !== undefined) options.push({ value: 'deletions', label: 'Deletions' });
    if (firstItem.merges !== undefined) options.push({ value: 'merges', label: 'Merges' });
    if (firstItem.name !== undefined) options.push({ value: 'name', label: 'Name' });
    if (firstItem.email !== undefined) options.push({ value: 'email', label: 'Email' });
    if (firstItem.branches !== undefined) options.push({ value: 'branches', label: 'Branches' });
    if (firstItem.author !== undefined) options.push({ value: 'author', label: 'Author' });
    if (firstItem.subject !== undefined) options.push({ value: 'subject', label: 'Message' });
    if (firstItem.timestamp !== undefined) options.push({ value: 'timestamp', label: 'Date' });
    
    return options;
  };
  
  const sortOptions = getSortOptions();
  
  const getSortedItems = () => {
    if (!items) return [];
    
    const sorted = [...items].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'branches' && Array.isArray(aVal)) {
        aVal = aVal.length;
        bVal = bVal.length;
      }
      
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return sorted;
  };
  
  const sortedItems = getSortedItems();
  
  return (
    <div 
      onClick={onClose}
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        cursor: 'pointer',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '85vh',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          cursor: 'default',
          position: 'relative',
          animation: 'slideIn 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ padding: '32px 40px 24px', borderBottom: '2px solid #E8E8E8' }}>
          <button
            onClick={onClose}
            className="modal-close-btn"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: '#E8E8E8',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              fontWeight: '300',
              color: '#666'
            }}
          >
            ×
          </button>
          
          <h2 style={{
            margin: '0 0 20px',
            fontSize: '28px',
            fontWeight: '700',
            color: '#1A1A1A',
            fontFamily: 'Literata, serif',
            paddingRight: '50px'
          }}>
            {title}
          </h2>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', color: '#666', fontWeight: '600' }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '2px solid #E8E8E8',
                borderRadius: '6px',
                background: '#FAFAFA',
                cursor: 'pointer',
                fontFamily: 'IBM Plex Mono'
              }}
            >
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: '2px solid #E8E8E8',
                borderRadius: '6px',
                background: '#1A1A1A',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: '600',
                fontFamily: 'IBM Plex Mono'
              }}
            >
              {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
            
            <span style={{ fontSize: '13px', color: '#999', marginLeft: 'auto' }}>
              {sortedItems.length} items
            </span>
          </div>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 40px 40px' }}>
          {sortedItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '16px',
                marginBottom: '12px',
                background: '#F5F5F5',
                border: '1px solid #E8E8E8',
                borderRadius: '8px',
                transition: 'all 0.2s'
              }}
            >
              {item.name && item.email && (
                <>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1A1A1A', marginBottom: '8px' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                    {item.email}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px' }}>
                    <span><strong>Commits:</strong> {item.commits}</span>
                    <span><strong>Additions:</strong> +{item.additions.toLocaleString()}</span>
                    <span><strong>Deletions:</strong> -{item.deletions.toLocaleString()}</span>
                    <span><strong>Merges:</strong> {item.merges}</span>
                    {item.branches && <span><strong>Branches:</strong> {item.branches.length}</span>}
                  </div>
                </>
              )}
              
              {item.name && !item.email && (
                <>
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.repoInfo) {
                        window.open(`https://github.com/${window.repoInfo.owner}/${window.repoInfo.repo}/tree/${item.name}`, '_blank');
                      }
                    }}
                    style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: item.isStale ? '#999' : '#0077B6', 
                      marginBottom: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      cursor: 'pointer',
                      textDecoration: item.isStale ? 'line-through' : 'underline'
                    }}
                  >
                    {item.name}
                    {item.isPrimary && (
                      <span style={{ background: '#1A1A1A', color: '#fff', padding: '2px 8px', fontSize: '11px', borderRadius: '4px' }}>
                        PRIMARY
                      </span>
                    )}
                    {item.isStale && (
                      <span style={{ background: '#FFA500', color: '#fff', padding: '2px 8px', fontSize: '11px', borderRadius: '4px' }}>
                        STALE ({item.daysSinceLastCommit} days)
                      </span>
                    )}
                  </div>
                  {item.isStale && (
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                      Last commit: {new Date(item.lastCommit).toLocaleDateString()}
                    </div>
                  )}
                </>
              )}
              
              {item.hash && item.subject && (
                <>
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.repoInfo) {
                        window.open(`https://github.com/${window.repoInfo.owner}/${window.repoInfo.repo}/commit/${item.fullHash}`, '_blank');
                      }
                    }}
                    style={{ 
                      fontSize: '14px', 
                      color: '#0077B6', 
                      marginBottom: '8px',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {item.subject}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#666' }}>
                    <span>{item.hash}</span>
                    <span>{item.author}</span>
                    <span>{new Date(item.timestamp * 1000).toLocaleDateString()}</span>
                    {item.isMerge && (
                      <span style={{ background: '#7209B7', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' }}>
                        MERGE
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
