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

    const nodeSpacing = compact ? 40 : 60;
    const laneWidth = compact ? 60 : 80;
    const padding = 60;
    const canvasHeight = commits.length * nodeSpacing + padding * 2;

    svg.setAttribute('width', '100%');
    svg.setAttribute('height', canvasHeight);
    svg.setAttribute('viewBox', `0 0 1200 ${canvasHeight}`);

    // Assign lanes with better algorithm
    const lanes = new Map();
    const branchLanes = new Map();
    const centerLane = 5;
    branchLanes.set(primaryBranch, centerLane);
    let nextLane = centerLane - 1; // Start left
    let nextRightLane = centerLane + 1; // Alternate right
    let useLeft = true;

    commits.forEach((node, idx) => {
      const isOnPrimary = node.branches.includes(primaryBranch);
      
      if (isOnPrimary) {
        lanes.set(idx, centerLane);
      } else {
        let lane = null;
        
        // Check if any of this commit's branches already has a lane
        for (const branch of node.branches) {
          if (branchLanes.has(branch)) {
            lane = branchLanes.get(branch);
            break;
          }
        }
        
        // Assign new lane if needed
        if (lane === null && node.branches[0] && node.branches[0] !== primaryBranch) {
          // Alternate left and right for visual balance
          if (useLeft) {
            lane = nextLane;
            nextLane--;
          } else {
            lane = nextRightLane;
            nextRightLane++;
          }
          useLeft = !useLeft;
          branchLanes.set(node.branches[0], lane);
        }
        
        lanes.set(idx, lane || centerLane);
      }
    });

    const colors = ['#2D6A4F', '#C9184A', '#1A1A1A', '#7209B7', '#0077B6', '#FFC75F', '#FF6B9D', '#845EC2'];

    // Draw connections
    commits.forEach((node, idx) => {
      const y = idx * nodeSpacing + padding;
      const lane = lanes.get(idx) || centerLane;
      const x = lane * laneWidth + padding + 200;

      node.parents.forEach(parentHash => {
        const parentIdx = commits.findIndex(n => n.hash === parentHash);
        if (parentIdx !== -1 && parentIdx > idx) {
          const parentY = parentIdx * nodeSpacing + padding;
          const parentLane = lanes.get(parentIdx) || centerLane;
          const parentX = parentLane * laneWidth + padding + 200;
          const color = colors[lane % colors.length];

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          if (lane === parentLane) {
            path.setAttribute('d', `M ${x} ${y} L ${parentX} ${parentY}`);
          } else {
            const midY = (y + parentY) / 2;
            path.setAttribute('d', `M ${x} ${y} C ${x} ${midY}, ${parentX} ${midY}, ${parentX} ${parentY}`);
          }
          path.setAttribute('stroke', color);
          path.setAttribute('stroke-width', '3');
          path.setAttribute('fill', 'none');
          path.setAttribute('opacity', '0.6');
          svg.appendChild(path);
        }
      });
    });

    // Draw commit dots
    commits.forEach((node, idx) => {
      const y = idx * nodeSpacing + padding;
      const lane = lanes.get(idx) || centerLane;
      const x = lane * laneWidth + padding + 200;
      const isOnPrimary = node.branches.includes(primaryBranch);
      const color = colors[lane % colors.length];

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('cursor', 'pointer');
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', node.isMerge ? 7 : 5);
      circle.setAttribute('fill', isOnPrimary ? '#1A1A1A' : color);
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '2');

      // Add click handler
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onCommitClick) {
          onCommitClick(node);
        } else if (window.repoInfo) {
          window.open(`https://github.com/${window.repoInfo.owner}/${window.repoInfo.repo}/commit/${node.fullHash}`, '_blank');
        }
      });

      // Hover effect and tooltip
      g.addEventListener('mouseenter', (e) => {
        circle.setAttribute('r', node.isMerge ? 10 : 8);
        
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const date = new Date(node.timestamp * 1000);
          const dateStr = date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric', 
            minute: '2-digit'
          });
          
          setTooltip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            commit: node.hash,
            author: node.author,
            date: dateStr,
            message: node.subject,
            branches: node.branches || [primaryBranch],
            isMerge: node.isMerge
          });
        }
      });
      
      g.addEventListener('mouseleave', () => {
        circle.setAttribute('r', node.isMerge ? 7 : 5);
        setTooltip(null);
      });

      g.appendChild(circle);
      svg.appendChild(g);
      
      // Add commit hash and branch name label to the right
      const labelG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      // Commit hash
      const hashText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      hashText.setAttribute('x', x + 15);
      hashText.setAttribute('y', y + 4);
      hashText.setAttribute('fill', '#666');
      hashText.setAttribute('font-size', compact ? '10' : '11');
      hashText.setAttribute('font-family', 'IBM Plex Mono');
      hashText.textContent = node.hash;
      labelG.appendChild(hashText);
      
      // Branch name(s)
      const branchNames = node.branches && node.branches.length > 0 
        ? node.branches.join(', ') 
        : primaryBranch;
      const branchText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      branchText.setAttribute('x', x + 75);
      branchText.setAttribute('y', y + 4);
      branchText.setAttribute('fill', isOnPrimary ? '#1A1A1A' : color);
      branchText.setAttribute('font-size', compact ? '10' : '11');
      branchText.setAttribute('font-weight', '600');
      branchText.setAttribute('font-family', 'IBM Plex Mono');
      branchText.textContent = branchNames.length > 30 ? branchNames.substring(0, 27) + '...' : branchNames;
      labelG.appendChild(branchText);
      
      svg.appendChild(labelG);
    });

    // Branch labels - only show primary branch
    const primaryLane = branchLanes.get(primaryBranch);
    if (primaryLane !== undefined) {
      const x = primaryLane * laneWidth + padding + 200;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', 30);
      text.setAttribute('fill', colors[primaryLane % colors.length]);
      text.setAttribute('font-size', '14');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-family', 'IBM Plex Mono');
      text.textContent = primaryBranch;
      svg.appendChild(text);
    }
  }, [commits, primaryBranch, compact, onCommitClick]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 15,
            top: tooltip.y - 20,
            background: 'rgba(26, 26, 26, 0.95)',
            color: '#FAF9F6',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            pointerEvents: 'none',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxWidth: '400px',
            border: '2px solid #fff',
            fontFamily: 'IBM Plex Mono, monospace'
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>{tooltip.author}</div>
          <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>
            Commit: {tooltip.commit}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>
            Branch: {tooltip.branches.join(', ')}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>
            {tooltip.date}
          </div>
          {tooltip.isMerge && (
            <div style={{ 
              marginBottom: '8px', 
              padding: '2px 6px', 
              background: '#7209B7', 
              color: '#fff', 
              borderRadius: '3px', 
              display: 'inline-block', 
              fontSize: '11px' 
            }}>
              MERGE
            </div>
          )}
          <div style={{ 
            marginTop: '8px', 
            paddingTop: '8px', 
            borderTop: '1px solid #666', 
            fontSize: '12px', 
            fontStyle: 'italic', 
            color: '#ccc' 
          }}>
            {tooltip.message}
          </div>
        </div>
      )}
    </div>
  );
}
