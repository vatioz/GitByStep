import type { Commit, CommitId, Head, RepoKind, RepoState, World } from './types';
import { GitError } from './types';

export const REMOTE_NAME = 'origin';
export const DEFAULT_BRANCH = 'main';

/** Deterministic 7-char pseudo hash so replays always produce identical ids. */
export function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0').slice(0, 7);
}

export function uniqueHash(taken: Record<CommitId, unknown>, seed: string): CommitId {
  let salt = 0;
  let id = shortHash(seed);
  while (id in taken) {
    salt += 1;
    id = shortHash(`${seed}#${salt}`);
  }
  return id;
}

export function emptyRepo(kind: RepoKind, label: string): RepoState {
  return {
    kind,
    label,
    commits: {},
    branches: {},
    remoteRefs: {},
    tags: {},
    head: { type: 'branch', branch: DEFAULT_BRANCH },
  };
}

export function createWorld(): World {
  return {
    local: emptyRepo('local', 'Local repository'),
    remote: emptyRepo('remote', `Remote (${REMOTE_NAME})`),
    seq: 0,
    upstream: {},
  };
}

export function cloneRepo(repo: RepoState): RepoState {
  return {
    ...repo,
    commits: { ...repo.commits },
    branches: { ...repo.branches },
    remoteRefs: { ...repo.remoteRefs },
    tags: { ...repo.tags },
    head: { ...repo.head },
  };
}

export function cloneWorld(world: World): World {
  return {
    local: cloneRepo(world.local),
    remote: cloneRepo(world.remote),
    seq: world.seq,
    upstream: { ...world.upstream },
  };
}

export function repoOf(world: World, kind: RepoKind): RepoState {
  return kind === 'local' ? world.local : world.remote;
}

export function withRepo(world: World, repo: RepoState): World {
  return repo.kind === 'local' ? { ...world, local: repo } : { ...world, remote: repo };
}

export function headBranch(repo: RepoState): string | undefined {
  return repo.head.type === 'branch' ? repo.head.branch : undefined;
}

export function headCommit(repo: RepoState): CommitId | undefined {
  if (repo.head.type === 'detached') return repo.head.commit;
  return repo.branches[repo.head.branch];
}

/** A branch that is checked out but has no commit yet (git calls this an unborn branch). */
export function isUnborn(repo: RepoState): boolean {
  return repo.head.type === 'branch' && !(repo.head.branch in repo.branches);
}

export function describeHead(repo: RepoState): string {
  return repo.head.type === 'branch' ? repo.head.branch : `HEAD detached at ${repo.head.commit}`;
}

export function resolveRef(repo: RepoState, ref: string): CommitId | undefined {
  if (!ref) return undefined;
  if (ref === 'HEAD') return headCommit(repo);
  if (ref in repo.branches) return repo.branches[ref];
  if (ref in repo.remoteRefs) return repo.remoteRefs[ref];
  if (ref in repo.tags) return repo.tags[ref];
  if (ref in repo.commits) return ref;
  const caret = /^(.*)([~^])(\d*)$/.exec(ref);
  if (caret) {
    const base = resolveRef(repo, caret[1]);
    if (!base) return undefined;
    const steps = caret[2] === '~' ? Number(caret[3] || 1) : 1;
    let cur: CommitId | undefined = base;
    for (let i = 0; i < steps && cur; i++) cur = repo.commits[cur]?.parents[0];
    return cur;
  }
  return undefined;
}

export function mustResolve(repo: RepoState, ref: string): CommitId {
  const id = resolveRef(repo, ref);
  if (!id) {
    throw new GitError(
      `fatal: '${ref}' did not match any known ref`,
      `There is no branch, tag or commit called \`${ref}\` in the ${repo.kind} repository yet.`,
    );
  }
  return id;
}

export function ancestorsOf(repo: RepoState, ids: CommitId[]): Set<CommitId> {
  const seen = new Set<CommitId>();
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop()!;
    if (!id || seen.has(id)) continue;
    const commit = repo.commits[id];
    if (!commit) continue;
    seen.add(id);
    for (const p of commit.parents) stack.push(p);
  }
  return seen;
}

export function isAncestor(repo: RepoState, maybeAncestor: CommitId, descendant: CommitId): boolean {
  if (maybeAncestor === descendant) return true;
  return ancestorsOf(repo, [descendant]).has(maybeAncestor);
}

/** Best common ancestor, picked by highest seq (good enough for teaching scenarios). */
export function mergeBase(repo: RepoState, a: CommitId, b: CommitId): CommitId | undefined {
  const aAnc = ancestorsOf(repo, [a]);
  const bAnc = ancestorsOf(repo, [b]);
  let best: Commit | undefined;
  for (const id of aAnc) {
    if (!bAnc.has(id)) continue;
    const c = repo.commits[id];
    if (!best || c.seq > best.seq) best = c;
  }
  return best?.id;
}

/** All refs a commit can be reached from, used to fade out unreachable (orphaned) commits. */
export function reachableCommits(repo: RepoState): Set<CommitId> {
  const tips = [
    ...Object.values(repo.branches),
    ...Object.values(repo.remoteRefs),
    ...Object.values(repo.tags),
  ];
  const head = headCommit(repo);
  if (head) tips.push(head);
  return ancestorsOf(repo, tips);
}

export function refsPointingAt(repo: RepoState, id: CommitId): string[] {
  const names: string[] = [];
  for (const [name, target] of Object.entries(repo.branches)) if (target === id) names.push(name);
  for (const [name, target] of Object.entries(repo.remoteRefs)) if (target === id) names.push(name);
  for (const [name, target] of Object.entries(repo.tags)) if (target === id) names.push(name);
  return names;
}

/** Copy every commit reachable from `tips` in `from` into `to`. Returns the ids actually copied. */
export function transferCommits(from: RepoState, to: RepoState, tips: CommitId[]): CommitId[] {
  const needed = ancestorsOf(from, tips);
  const copied: CommitId[] = [];
  for (const id of needed) {
    if (id in to.commits) continue;
    to.commits[id] = from.commits[id];
    copied.push(id);
  }
  return copied;
}

export function setHead(repo: RepoState, head: Head): void {
  repo.head = head;
}

export function commitsAheadBehind(
  repo: RepoState,
  local: CommitId | undefined,
  remote: CommitId | undefined,
): { ahead: number; behind: number } {
  if (!local && !remote) return { ahead: 0, behind: 0 };
  const localAnc = local ? ancestorsOf(repo, [local]) : new Set<CommitId>();
  const remoteAnc = remote ? ancestorsOf(repo, [remote]) : new Set<CommitId>();
  let ahead = 0;
  let behind = 0;
  for (const id of localAnc) if (!remoteAnc.has(id)) ahead++;
  for (const id of remoteAnc) if (!localAnc.has(id)) behind++;
  return { ahead, behind };
}

export function nextCommitMessage(repo: RepoState): string {
  const count = Object.keys(repo.commits).length + 1;
  return `commit ${count}`;
}
