import type { Commit, CommitId, RepoState, World } from '../git/types';
import { headBranch, headCommit, isUnborn, reachableCommits } from '../git/repo';

export const LANE_COLORS = [
  '#5b9dff',
  '#f2a33c',
  '#a97bf0',
  '#2fc4a0',
  '#ff6b81',
  '#38bdf8',
  '#f472b6',
  '#a3e635',
];

export const X_STEP = 84;
export const Y_STEP = 68;
export const NODE_R = 17;
const PAD_X = 56;
const BADGE_H = 22;
const BADGE_GAP = 10;
const BADGE_CHAR = 7.4;
const MSG_CHAR = 5.7;

export interface LayoutNode {
  id: CommitId;
  commit: Commit;
  x: number;
  y: number;
  lane: number;
  color: string;
  reachable: boolean;
}

export interface LayoutEdge {
  key: string;
  d: string;
  color: string;
  isMerge: boolean;
  reachable: boolean;
}

export type BadgeKind = 'branch' | 'remote' | 'tag' | 'head';

export interface LayoutBadge {
  key: string;
  label: string;
  kind: BadgeKind;
  x: number;
  y: number;
  color: string;
  isHead: boolean;
  commitId: CommitId;
}

export interface RepoLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  badges: LayoutBadge[];
  width: number;
  height: number;
  topPad: number;
  /** How many characters of a commit message fit under a node. */
  msgChars: number;
  /** Set when the checked-out branch has no commits yet. */
  unbornBranch?: string;
}

export function badgeWidth(label: string, isHead: boolean): number {
  return label.length * BADGE_CHAR + (isHead ? 46 : 18);
}

/**
 * Shared metrics so the local and the remote panel use identical geometry:
 * same lane per branch name and the same horizontal step.
 */
export interface LayoutContext {
  lanes: Map<string, number>;
  xStep: number;
}

export function computeLayoutContext(world: World): LayoutContext {
  const lanes = computeLanes(world);
  let widest = 0;
  for (const repo of [world.local, world.remote]) {
    const names = [
      ...Object.keys(repo.branches),
      ...Object.keys(repo.remoteRefs),
      ...Object.keys(repo.tags),
    ];
    for (const name of names) widest = Math.max(widest, badgeWidth(name, true));
  }
  return { lanes, xStep: Math.max(X_STEP, Math.round(widest) + 10) };
}

/**
 * Lanes are assigned across both repositories so that a branch keeps the same
 * row in the local and the remote panel.
 */
export function computeLanes(world: World): Map<string, number> {
  const firstSeen = new Map<string, number>();
  for (const repo of [world.local, world.remote]) {
    for (const commit of Object.values(repo.commits)) {
      const prev = firstSeen.get(commit.lane);
      if (prev === undefined || commit.seq < prev) firstSeen.set(commit.lane, commit.seq);
    }
    const branch = headBranch(repo);
    if (branch && !firstSeen.has(branch)) firstSeen.set(branch, Number.MAX_SAFE_INTEGER);
  }

  const names = [...firstSeen.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);

  // The default branch always owns the top lane, whatever the commit order says.
  for (const preferred of ['main', 'master']) {
    const idx = names.indexOf(preferred);
    if (idx > 0) {
      names.splice(idx, 1);
      names.unshift(preferred);
    }
  }

  return new Map(names.map((name, i) => [name, i]));
}

export function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

function badgeKind(repo: RepoState, name: string): BadgeKind {
  if (name in repo.tags) return 'tag';
  if (name in repo.remoteRefs) return 'remote';
  return 'branch';
}

export function layoutRepo(repo: RepoState, ctx: LayoutContext): RepoLayout {
  const { lanes, xStep } = ctx;
  const commits = Object.values(repo.commits).sort((a, b) => a.seq - b.seq);
  const reachable = reachableCommits(repo);

  const refsByCommit = new Map<CommitId, string[]>();
  const pushRef = (id: CommitId, name: string) => {
    const list = refsByCommit.get(id) ?? [];
    list.push(name);
    refsByCommit.set(id, list);
  };
  for (const [name, id] of Object.entries(repo.branches)) pushRef(id, name);
  for (const [name, id] of Object.entries(repo.remoteRefs)) pushRef(id, name);
  for (const [name, id] of Object.entries(repo.tags)) pushRef(id, name);
  if (repo.head.type === 'detached') pushRef(repo.head.commit, 'HEAD');

  const maxBadges = Math.max(0, ...[...refsByCommit.values()].map((r) => r.length));
  // extra headroom so the HEAD badge glow is not clipped by the svg viewport
  const topPad = 34 + maxBadges * (BADGE_H + 6);

  const laneCount = Math.max(1, lanes.size);
  const positions = new Map<CommitId, { x: number; y: number; color: string; lane: number }>();

  const nodes: LayoutNode[] = commits.map((commit, index) => {
    const lane = lanes.get(commit.lane) ?? 0;
    const x = PAD_X + index * xStep;
    const y = topPad + lane * Y_STEP;
    const color = laneColor(lane);
    positions.set(commit.id, { x, y, color, lane });
    return { id: commit.id, commit, x, y, lane, color, reachable: reachable.has(commit.id) };
  });

  const edges: LayoutEdge[] = [];
  for (const node of nodes) {
    node.commit.parents.forEach((parentId, i) => {
      const p = positions.get(parentId);
      if (!p) return;
      const dx = node.x - p.x;
      const d =
        p.y === node.y
          ? `M ${p.x} ${p.y} L ${node.x} ${node.y}`
          : `M ${p.x} ${p.y} C ${p.x + dx * 0.5} ${p.y}, ${node.x - dx * 0.5} ${node.y}, ${node.x} ${node.y}`;
      edges.push({
        key: `${parentId}->${node.id}`,
        d,
        color: i === 0 ? node.color : p.color,
        isMerge: node.commit.parents.length > 1,
        reachable: node.reachable,
      });
    });
  }

  const badges: LayoutBadge[] = [];
  const head = headCommit(repo);
  const currentBranch = headBranch(repo);
  for (const [id, names] of refsByCommit) {
    const p = positions.get(id);
    if (!p) continue;
    const sorted = [...names].sort((a, b) => {
      const rank = (n: string) => (n === currentBranch ? 0 : badgeKind(repo, n) === 'branch' ? 1 : badgeKind(repo, n) === 'remote' ? 2 : 3);
      return rank(a) - rank(b) || a.localeCompare(b);
    });
    sorted.forEach((name, i) => {
      const kind: BadgeKind = name === 'HEAD' ? 'head' : badgeKind(repo, name);
      badges.push({
        key: `${id}:${name}`,
        label: name,
        kind,
        x: p.x,
        y: p.y - NODE_R - BADGE_GAP - (sorted.length - 1 - i) * (BADGE_H + 6) - BADGE_H / 2,
        color: kind === 'branch' ? laneColor(lanes.get(name) ?? p.lane) : p.color,
        isHead: (name === currentBranch && head === id) || name === 'HEAD',
        commitId: id,
      });
    });
  }

  const width = PAD_X * 2 + Math.max(0, nodes.length - 1) * xStep;
  const height = topPad + (laneCount - 1) * Y_STEP + NODE_R + 56;

  return {
    nodes,
    edges,
    badges,
    width,
    height,
    topPad,
    msgChars: Math.max(6, Math.floor((xStep - 10) / MSG_CHAR)),
    unbornBranch: isUnborn(repo) ? headBranch(repo) : undefined,
  };
}
