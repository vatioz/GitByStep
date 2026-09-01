import { useEffect, useMemo, useRef } from 'react';
import type { RepoState } from '../git/types';
import { type LayoutContext, NODE_R, badgeWidth, layoutRepo } from '../layout/layout';

interface Props {
  repo: RepoState;
  ctx: LayoutContext;
  newCommits: Set<string>;
  transferred: Set<string>;
  movedRefs: Set<string>;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function GraphView({ repo, ctx, newCommits, transferred, movedRefs }: Props) {
  const layout = useMemo(() => layoutRepo(repo, ctx), [repo, ctx]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastNodeX = layout.nodes.length ? layout.nodes[layout.nodes.length - 1].x : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = lastNodeX + 120 - el.clientWidth;
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [lastNodeX]);

  if (!layout.nodes.length) {
    return (
      <div className="graph-empty" ref={scrollRef}>
        {layout.unbornBranch ? (
          <span>
            on <code>{layout.unbornBranch}</code> — no commits yet
          </span>
        ) : (
          <span>empty repository</span>
        )}
      </div>
    );
  }

  return (
    <div className="graph-scroll" ref={scrollRef}>
      <svg
        className="graph"
        width={Math.max(layout.width, 100)}
        height={layout.height}
        viewBox={`0 0 ${Math.max(layout.width, 100)} ${layout.height}`}
      >
        <g className="edges">
          {layout.edges.map((edge) => (
            <path
              key={edge.key}
              d={edge.d}
              className={`edge${edge.isMerge ? ' is-merge' : ''}${edge.reachable ? '' : ' is-orphan'}`}
              stroke={edge.color}
            />
          ))}
        </g>

        <g className="nodes">
          {layout.nodes.map((node) => {
            const classes = ['node'];
            if (!node.reachable) classes.push('is-orphan');
            if (newCommits.has(node.id)) classes.push('is-new');
            if (transferred.has(node.id)) classes.push('is-transferred');
            if (node.commit.parents.length > 1) classes.push('is-merge');
            return (
              <g
                key={node.id}
                className={classes.join(' ')}
                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
              >
                <title>{`${node.id} — ${node.commit.message}`}</title>
                <circle className="node-halo" r={NODE_R + 7} fill={node.color} />
                <circle className="node-dot" r={NODE_R} fill={node.color} />
                {node.commit.parents.length > 1 && <circle className="node-inner" r={NODE_R - 7} />}
                <text className="node-hash" y={NODE_R + 17}>
                  {node.id}
                </text>
                <text className="node-msg" y={NODE_R + 31}>
                  {truncate(node.commit.message, layout.msgChars)}
                </text>
              </g>
            );
          })}
        </g>

        <g className="badges">
          {layout.badges.map((badge) => {
            const width = badgeWidth(badge.label, badge.isHead && badge.kind !== 'head');
            return (
              <g
                key={badge.key}
                className={`badge kind-${badge.kind}${badge.isHead ? ' is-head' : ''}${
                  movedRefs.has(badge.label) ? ' is-moved' : ''
                }`}
                style={{ transform: `translate(${badge.x}px, ${badge.y}px)` }}
              >
                <g className="badge-inner">
                  <line className="badge-tail" x1={0} y1={4} x2={0} y2={18} stroke={badge.color} />
                  <rect
                    x={-width / 2}
                    y={-11}
                    width={width}
                    height={22}
                    rx={11}
                    fill={badge.color}
                    className="badge-bg"
                  />
                  <text className="badge-text" y={4}>
                    {badge.isHead && badge.kind !== 'head' ? `HEAD → ${badge.label}` : badge.label}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
