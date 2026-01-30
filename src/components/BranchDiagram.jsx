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

    // GitHub network graph style - vertical timeline
    const commitSpacing = compact ? 50 : 70;
    const laneWidth = compact ? 50 : 70;
    const padding = { top: 60, right: 40, bottom: 40, left: 40 };
    
    // Assign branches to horizontal lanes
    const branchLanes = new Map();
    const lanes = new Map();
    
    // Primary branch gets center lane
    const centerLane = 5;
    branchLanes.set(primaryBranch, centerLane);
    
    // Assign other branches alternating left and right
    let leftLane = centerLane - 1;
    let rightLane = centerLane + 1;
    let useLeft = true;
    
    commits.forEach((commit, idx) => {
      commit.branches.forEach(branch => {
        if (!branchLanes.has(branch)) {
          if (useLeft) {
            branchLanes.set(branch, leftLane);
            leftLane--;
            useLeft = false;
          } else {
            branchLanes.set(branch, rightLane);
            rightLane++;
            useLeft = true;
          }
        }
      });
      
      // Assign commit to its primary branch lane
      const mainBranch = commit.branches.includes(primaryBranch) 
        ? primaryBranch 
        : commit.branches[0];
      lanes.set(idx, branchLanes.get(mainBranch) || centerLane);
    });

    const canvasHeight = commits.length * commitSpacing + padding.top + padding.bottom;
    const maxLane = Math.max(...branchLanes.values());
    const minLane = Math.min(...branchLanes.values());
    const canvasWidth = (maxLane - minLane + 1) * laneWidth + padding.left + padding.right;

    svg.setAttribute('width', '100%');
    svg.setAttribute('height', canvasHeight);
    svg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Draw connecting lines between commits
    for (let i = 1; i < commits.length; i++) {
      const prevCommit = commits[i - 1];
      const currCommit = commits[i];
      
      const prevLane = lanes.get(i - 1);
      const currLane = lanes.get(i);
      
      const x1 = padding.left + (prevLane - minLane) * laneWidth;
      const y1 = padding.top + (i - 1) * commitSpacing;
      const x2 = padding.left + (currLane - minLane) * laneWidth;
      const y2 = padding.top + i * commitSpacing;
      
      const isPrimary = prevCommit.branches.includes(primaryBranch) && currCommit.branches.includes(primaryBranch);
      
      if (x1 === x2) {
        // Straight vertical line (same branch)
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', isPrimary ? '#0366d6' : '#28a745');
        line.setAttribute('stroke-width', isPrimary ? '3' : '2');
        line.setAttribute('opacity', '0.6');
        g.appendChild(line);
      } else {
        // Curved line (branch merge/diverge)
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midY = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#586069');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.5');
        g.appendChild(path);
      }
    }

    svg.appendChild(g);

    // Draw commits
    commits.forEach((commit, idx) => {
      const lane = lanes.get(idx);
      const x = padding.left + (lane - minLane) * laneWidth;
      const y = padding.top + idx * commitSpacing;
      const isPrimary = commit.branches.includes(primaryBranch);
      const isMerge = commit.isMerge;

      // Commit circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', isMerge ? '7' : '5');
      circle.setAttribute('fill', isPrimary ? '#0366d6' : '#28a745');
      circle.setAttribute('stroke', '#ffffff');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('cursor', 'pointer');
      
      // Hover effects
      circle.addEventListener('mouseenter', (e) => {
        circle.setAttribute('r', isMerge ? '9' : '7');
        circle.setAttribute('stroke-width', '3');
        
        const rect = svg.getBoundingClientRect();
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          commit
        });
      });
      
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('r', isMerge ? '7' : '5');
        circle.setAttribute('stroke-width', '2');
        setTooltip(null);
      });
      
      if (onCommitClick) {
        circle.addEventListener('click', () => onCommitClick(commit));
      }
      
      svg.appendChild(circle);

      // Commit message to the right (GitHub style)
      if (!compact) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x + 15);
        text.setAttribute('y', y + 4);
        text.setAttribute('font-size', '12');
        text.setAttribute('fill', '#24292e');
        text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif');
        text.textContent = commit.subject.length > 50 ? commit.subject.substring(0, 47) + '...' : commit.subject;
        svg.appendChild(text);
        
        // Author and hash below
        const meta = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        meta.setAttribute('x', x + 15);
        meta.setAttribute('y', y + 18);
        meta.setAttribute('font-size', '10');
        meta.setAttribute('fill', '#586069');
        meta.setAttribute('font-family', 'monospace');
        meta.textContent = `${commit.author.split(' ')[0]} • ${commit.hash}`;
        svg.appendChild(meta);
      }
    });

    // Draw branch labels at the top
    branchLanes.forEach((lane, branch) => {
      const x = padding.left + (lane - minLane) * laneWidth;
      const isPrimary = branch === primaryBranch;
      
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', padding.top - 20);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', isPrimary ? '600' : '400');
      label.setAttribute('fill', isPrimary ? '#0366d6' : '#28a745');
      label.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif');
      label.textContent = branch;
      svg.appendChild(label);
      
      // Small circle indicator
      const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      indicator.setAttribute('cx', x);
      indicator.setAttribute('cy', padding.top - 35);
      indicator.setAttribute('r', '4');
      indicator.setAttribute('fill', isPrimary ? '#0366d6' : '#28a745');
      svg.appendChild(indicator);
    });

  }, [commits, primaryBranch, compact, onCommitClick]);

  return (
    <div ref={containerRef} style={{ 
      position: 'relative', 
      width: '100%', 
      overflowY: 'auto', 
      maxHeight: '800px',
      background: '#ffffff', 
      borderRadius: '6px', 
      border: '1px solid #e1e4e8',
      padding: '20px' 
    }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
      
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 15,
          top: tooltip.y - 10,
          background: '#24292e',
          color: '#ffffff',
          padding: '10px 14px',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
          pointerEvents: 'none',
          zIndex: 1000,
          maxWidth: '400px',
          boxShadow: '0 3px 12px rgba(0,0,0,0.3)',
          border: '1px solid #444d56'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '6px', fontFamily: 'monospace' }}>
            {tooltip.commit.hash}
          </div>
          <div style={{ marginBottom: '6px' }}>
            {tooltip.commit.subject}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>
            {tooltip.commit.author}
          </div>
          <div style={{ fontSize: '10px', opacity: 0.7, fontFamily: 'monospace' }}>
            {tooltip.commit.branches.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}
