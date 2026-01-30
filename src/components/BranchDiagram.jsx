import { useEffect, useRef, useState } from 'react';

export default function BranchDiagram({ commits, primaryBranch, compact = false, onCommitClick }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!svgRef.current || !commits || commits.length === 0) return;

    const svg = svgRef.current;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Classic Git visualization - horizontal timeline
    const commitSpacing = 120;
    const laneHeight = 60;
    const padding = { top: 40, right: 40, bottom: 40, left: 120 };
    
    // Assign branches to lanes
    const branchLanes = new Map();
    const lanes = new Map();
    let currentLane = 0;
    
    branchLanes.set(primaryBranch, currentLane);
    currentLane++;
    
    commits.forEach((commit, idx) => {
      commit.branches.forEach(branch => {
        if (!branchLanes.has(branch)) {
          branchLanes.set(branch, currentLane);
          currentLane++;
        }
      });
      
      const mainBranch = commit.branches[0] || primaryBranch;
      lanes.set(idx, branchLanes.get(mainBranch));
    });

    const canvasWidth = commits.length * commitSpacing + padding.left + padding.right;
    const canvasHeight = currentLane * laneHeight + padding.top + padding.bottom;

    svg.setAttribute('width', '100%');
    svg.setAttribute('height', canvasHeight);
    svg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Draw branch lines
    branchLanes.forEach((lane, branch) => {
      const y = padding.top + lane * laneHeight;
      const isPrimary = branch === primaryBranch;
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padding.left);
      line.setAttribute('y1', y);
      line.setAttribute('x2', canvasWidth - padding.right);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', isPrimary ? '#0066CC' : '#28A745');
      line.setAttribute('stroke-width', isPrimary ? '3' : '2');
      line.setAttribute('opacity', '0.3');
      g.appendChild(line);
      
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', padding.left - 10);
      label.setAttribute('y', y + 5);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', isPrimary ? '600' : '400');
      label.setAttribute('fill', isPrimary ? '#0066CC' : '#28A745');
      label.setAttribute('font-family', 'IBM Plex Mono, monospace');
      label.textContent = branch;
      g.appendChild(label);
    });

    // Draw merge lines
    commits.forEach((commit, idx) => {
      if (commit.parents && commit.parents.length > 1) {
        const x = padding.left + idx * commitSpacing;
        const y = padding.top + lanes.get(idx) * laneHeight;
        
        commit.parents.forEach(parentHash => {
          const parentIdx = commits.findIndex(c => c.hash === parentHash);
          if (parentIdx !== -1 && parentIdx < idx) {
            const parentX = padding.left + parentIdx * commitSpacing;
            const parentY = padding.top + lanes.get(parentIdx) * laneHeight;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const midX = (x + parentX) / 2;
            const d = `M ${parentX} ${parentY} Q ${midX} ${parentY} ${midX} ${(y + parentY) / 2} T ${x} ${y}`;
            path.setAttribute('d', d);
            path.setAttribute('stroke', '#999');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('opacity', '0.4');
            path.setAttribute('stroke-dasharray', '5,5');
            g.appendChild(path);
          }
        });
      }
    });

    svg.appendChild(g);

    // Draw commits
    commits.forEach((commit, idx) => {
      const x = padding.left + idx * commitSpacing;
      const lane = lanes.get(idx);
      const y = padding.top + lane * laneHeight;
      const isPrimary = commit.branches.includes(primaryBranch);
      const isMerge = commit.isMerge;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', isMerge ? '10' : '8');
      circle.setAttribute('fill', isPrimary ? '#0066CC' : '#28A745');
      circle.setAttribute('stroke', '#ffffff');
      circle.setAttribute('stroke-width', '3');
      circle.setAttribute('cursor', 'pointer');
      
      circle.addEventListener('mouseenter', (e) => {
        circle.setAttribute('r', isMerge ? '12' : '10');
        circle.setAttribute('stroke-width', '4');
        
        const rect = svg.getBoundingClientRect();
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          commit
        });
      });
      
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('r', isMerge ? '10' : '8');
        circle.setAttribute('stroke-width', '3');
        setTooltip(null);
      });
      
      if (onCommitClick) {
        circle.addEventListener('click', () => onCommitClick(commit));
      }
      
      svg.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y + 25);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', '#666');
      text.setAttribute('font-family', 'IBM Plex Mono, monospace');
      text.textContent = commit.hash;
      svg.appendChild(text);
    });

  }, [commits, primaryBranch, compact, onCommitClick]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto', background: '#fafafa', borderRadius: '8px', padding: '20px' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
      
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 15,
          top: tooltip.y - 10,
          background: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '6px',
          fontSize: '13px',
          fontFamily: 'IBM Plex Mono, monospace',
          pointerEvents: 'none',
          zIndex: 1000,
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '6px' }}>
            {tooltip.commit.hash}
          </div>
          <div style={{ opacity: 0.9, marginBottom: '6px' }}>
            {tooltip.commit.subject}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>
            {tooltip.commit.author}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.6 }}>
            {tooltip.commit.branches.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}
