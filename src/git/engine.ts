import type { ApplyResult, Command, CommitId, RepoState, StepEffects, World } from './types';
import { GitError } from './types';
import {
  DEFAULT_BRANCH,
  REMOTE_NAME,
  ancestorsOf,
  cloneWorld,
  commitsAheadBehind,
  headBranch,
  headCommit,
  isAncestor,
  isUnborn,
  mergeBase,
  mustResolve,
  nextCommitMessage,
  reachableCommits,
  repoOf,
  resolveRef,
  transferCommits,
  uniqueHash,
} from './repo';

interface Ctx {
  world: World;
  repo: RepoState;
  effects: StepEffects;
}

function emptyEffects(): StepEffects {
  return { newCommits: [], transferredCommits: [], movedRefs: [], orphanedCommits: [] };
}

function createCommit(
  ctx: Ctx,
  parents: CommitId[],
  message: string,
  lane: string,
): CommitId {
  const { world, repo } = ctx;
  world.seq += 1;
  const id = uniqueHash(repo.commits, `${repo.kind}:${world.seq}:${message}:${parents.join(',')}`);
  repo.commits[id] = {
    id,
    parents,
    message,
    seq: world.seq,
    lane,
    origin: repo.kind,
  };
  ctx.effects.newCommits.push(id);
  return id;
}

function moveHeadTo(ctx: Ctx, id: CommitId): void {
  const { repo } = ctx;
  if (repo.head.type === 'branch') {
    repo.branches[repo.head.branch] = id;
    ctx.effects.movedRefs.push(repo.head.branch);
  } else {
    repo.head = { type: 'detached', commit: id };
  }
}

function requireHeadCommit(repo: RepoState): CommitId {
  const id = headCommit(repo);
  if (!id) {
    throw new GitError(
      'fatal: your current branch does not have any commits yet',
      'The branch exists only as a name until the first commit is made. Run `commit` first.',
    );
  }
  return id;
}

function currentLane(repo: RepoState): string {
  const branch = headBranch(repo);
  if (branch) return branch;
  const id = headCommit(repo);
  return id ? repo.commits[id].lane : DEFAULT_BRANCH;
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

function doCommit(ctx: Ctx, cmd: Command): Omit<ApplyResult, 'world'> {
  const { repo } = ctx;
  const message = cmd.message || nextCommitMessage(repo);
  const parent = headCommit(repo);
  const wasUnborn = isUnborn(repo);
  const id = createCommit(ctx, parent ? [parent] : [], message, currentLane(repo));
  moveHeadTo(ctx, id);
  const where = headBranch(repo) ?? 'detached HEAD';
  return {
    ok: true,
    level: 'success',
    message: `[${where} ${id}] ${message}`,
    explain: wasUnborn
      ? `The very first commit on \`${where}\` has no parent — it is the root of the history. The branch name now finally points at something.`
      : `A new commit \`${id}\` was created with \`${parent}\` as its parent. \`${where}\` moved forward to the new commit, because a branch is just a movable pointer to a commit.`,
    effects: ctx.effects,
  };
}

function doBranch(ctx: Ctx, cmd: Command): Omit<ApplyResult, 'world'> {
  const { repo } = ctx;
  const name = cmd.name!;
  if (name in repo.branches) {
    throw new GitError(`fatal: a branch named '${name}' already exists`);
  }
  const startRef = cmd.startPoint ?? 'HEAD';
  const target = cmd.startPoint ? mustResolve(repo, cmd.startPoint) : requireHeadCommit(repo);
  repo.branches[name] = target;
  ctx.effects.movedRefs.push(name);
  return {
    ok: true,
    level: 'success',
    message: `Created branch '${name}' at ${target}`,
    explain: `Creating a branch only writes a new pointer at \`${startRef}\` (${target}). No commits are copied and HEAD has not moved — you are still on \`${headBranch(repo) ?? 'a detached HEAD'}\`. Use \`checkout ${name}\` to start working on it.`,
    effects: ctx.effects,
  };
}

function doCheckout(ctx: Ctx, cmd: Command): Omit<ApplyResult, 'world'> {
  const { repo, world } = ctx;
  const ref = cmd.ref!;

  if (cmd.create) {
    if (ref in repo.branches) throw new GitError(`fatal: a branch named '${ref}' already exists`);
    const target = cmd.startPoint ? mustResolve(repo, cmd.startPoint) : headCommit(repo);
    if (target) {
      repo.branches[ref] = target;
      ctx.effects.movedRefs.push(ref);
    }
    repo.head = { type: 'branch', branch: ref };
    return {
      ok: true,
      level: 'success',
      message: `Switched to a new branch '${ref}'`,
      explain: `\`checkout -b\` is two steps in one: create the pointer \`${ref}\` at the current commit, then move HEAD onto it. New commits now extend \`${ref}\` and leave the previous branch untouched.`,
      effects: ctx.effects,
    };
  }

  if (ref in repo.branches) {
    repo.head = { type: 'branch', branch: ref };
    return {
      ok: true,
      level: 'success',
      message: `Switched to branch '${ref}'`,
      explain: `HEAD now points at the branch \`${ref}\` instead of a commit directly. Everything you commit from here moves \`${ref}\` forward.`,
      effects: ctx.effects,
    };
  }

  // DWIM: `checkout main` when only `origin/main` exists creates a tracking branch.
  const trackingName = `${REMOTE_NAME}/${ref}`;
  if (trackingName in repo.remoteRefs) {
    const target = repo.remoteRefs[trackingName];
    repo.branches[ref] = target;
    world.upstream[ref] = trackingName;
    repo.head = { type: 'branch', branch: ref };
    ctx.effects.movedRefs.push(ref);
    return {
      ok: true,
      level: 'success',
      message: `Branch '${ref}' set up to track '${trackingName}'.\nSwitched to a new branch '${ref}'`,
      explain: `There was no local branch \`${ref}\`, but the remote-tracking ref \`${trackingName}\` existed. Git created a local branch at the same commit and remembered the upstream link.`,
      effects: ctx.effects,
    };
  }

  const target = mustResolve(repo, ref);
  repo.head = { type: 'detached', commit: target };
  return {
    ok: true,
    level: 'warn',
    message: `Note: switching to '${ref}'.\nYou are in 'detached HEAD' state.`,
    explain: `HEAD now points straight at commit \`${target}\` instead of at a branch. Commits made here are not attached to any branch name, so they become unreachable as soon as you switch away.`,
    effects: ctx.effects,
  };
}

function doMerge(ctx: Ctx, cmd: Command): Omit<ApplyResult, 'world'> {
  const { repo } = ctx;
  const ref = cmd.ref!;
  const target = mustResolve(repo, ref);
  const head = requireHeadCommit(repo);
  const branch = headBranch(repo) ?? 'HEAD';

  if (isAncestor(repo, target, head)) {
    return {
      ok: true,
      level: 'info',
      message: 'Already up to date.',
      explain: `\`${ref}\` is already an ancestor of \`${branch}\`, so there is nothing to bring in.`,
      effects: ctx.effects,
    };
  }

  if (isAncestor(repo, head, target) && !cmd.noFF) {
    moveHeadTo(ctx, target);
    return {
      ok: true,
      level: 'success',
      message: `Updating ${head}..${target}\nFast-forward`,
      explain: `\`${branch}\` had no commits of its own, so git just slid the pointer forward to \`${target}\`. A fast-forward creates no new commit — that is why the history stays a straight line. Use \`merge ${ref} --no-ff\` to force a merge commit.`,
      effects: ctx.effects,
    };
  }

  const base = mergeBase(repo, head, target);
  const id = createCommit(ctx, [head, target], `Merge ${ref} into ${branch}`, currentLane(repo));
  moveHeadTo(ctx, id);
  return {
    ok: true,
    level: 'success',
    message: `Merge made by the 'ort' strategy.\n[${branch} ${id}]`,
    explain: `The branches diverged after \`${base ?? 'the root commit'}\`, so git created a **merge commit** \`${id}\` with two parents: \`${head}\` (${branch}) and \`${target}\` (${ref}). Both histories are preserved and joined.`,
    effects: ctx.effects,
  };
}

function doRebase(ctx: Ctx, cmd: Command): Omit<ApplyResult, 'world'> {
  const { repo } = ctx;
  const ref = cmd.ref!;
  const onto = mustResolve(repo, ref);
  const head = requireHeadCommit(repo);
  const branch = headBranch(repo);
  if (!branch) {
    throw new GitError('fatal: you are on a detached HEAD; rebase needs a branch');
  }
  if (isAncestor(repo, onto, head)) {
    return {
      ok: true,
      level: 'info',
      message: `Current branch ${branch} is up to date.`,
      explain: `\`${branch}\` already contains every commit from \`${ref}\`, so there is nothing to replay.`,
      effects: ctx.effects,
    };
  }
  if (isAncestor(repo, head, onto)) {
    moveHeadTo(ctx, onto);
    return {
      ok: true,
      level: 'success',
      message: `Fast-forwarded ${branch} to ${ref}.`,
      explain: `\`${branch}\` had no unique commits, so the rebase degenerated into moving the pointer to \`${onto}\`.`,
      effects: ctx.effects,
    };
  }

  const ontoAncestors = ancestorsOf(repo, [onto]);
  const toReplay = [...ancestorsOf(repo, [head])]
    .filter((id) => !ontoAncestors.has(id))
    .map((id) => repo.commits[id])
    .filter((c) => c.parents.length < 2)
    .sort((a, b) => a.seq - b.seq);

  const before = reachableCommits(repo);
  let cursor = onto;
  const created: CommitId[] = [];
  for (const old of toReplay) {
    cursor = createCommit(ctx, [cursor], old.message, branch);
    created.push(cursor);
  }
  moveHeadTo(ctx, cursor);

  const after = reachableCommits(repo);
  ctx.effects.orphanedCommits = [...before].filter((id) => !after.has(id));

  return {
    ok: true,
    level: 'success',
    message: `Successfully rebased and updated refs/heads/${branch}.`,
    explain: `Git took the ${toReplay.length} commit(s) unique to \`${branch}\` and **re-created them** on top of \`${ref}\`. The copies have new hashes (${created.join(', ')}) because a commit's id depends on its parent. The originals are now unreachable — shown faded — which is why rebasing rewrites history.`,
    effects: ctx.effects,
  };
}

function doTag(ctx: Ctx, cmd: Command): Omit<ApplyResult, 'world'> {
  const { repo } = ctx;
  const name = cmd.name!;
  if (name in repo.tags) throw new GitError(`fatal: tag '${name}' already exists`);
  const target = cmd.ref ? mustResolve(repo, cmd.ref) : requireHeadCommit(repo);
  repo.tags[name] = target;
  ctx.effects.movedRefs.push(name);
  return {
    ok: true,
    level: 'success',
    message: `Tagged ${target} as '${name}'`,
    explain: `A tag is a pointer like a branch, except it never moves on its own when you commit.`,
    effects: ctx.effects,
  };
}

function doReset(ctx: Ctx, cmd: Command): Omit<ApplyResult, 'world'> {
  const { repo } = ctx;
  const ref = cmd.ref!;
  const target = mustResolve(repo, ref);
  const branch = headBranch(repo);
  if (!branch) throw new GitError('fatal: reset needs a branch, you are on a detached HEAD');
  const before = reachableCommits(repo);
  repo.branches[branch] = target;
  ctx.effects.movedRefs.push(branch);
  const after = reachableCommits(repo);
  ctx.effects.orphanedCommits = [...before].filter((id) => !after.has(id));
  return {
    ok: true,
    level: 'warn',
    message: `HEAD is now at ${target}`,
    explain: `\`reset\` yanks the branch pointer \`${branch}\` to \`${target}\`. The commits left behind are not deleted, they just have no ref pointing at them any more (faded in the graph) until git garbage-collects them.`,
    effects: ctx.effects,
  };
}

function doFetch(ctx: Ctx): Omit<ApplyResult, 'world'> {
  const { world } = ctx;
  const local = world.local;
  const remote = world.remote;
  const tips = Object.values(remote.branches);
  const copied = transferCommits(remote, local, tips);
  ctx.effects.transferredCommits.push(...copied);

  const updated: string[] = [];
  for (const [name, tip] of Object.entries(remote.branches)) {
    const trackingName = `${REMOTE_NAME}/${name}`;
    if (local.remoteRefs[trackingName] !== tip) updated.push(trackingName);
    local.remoteRefs[trackingName] = tip;
    ctx.effects.movedRefs.push(trackingName);
  }
  for (const [name, tip] of Object.entries(remote.tags)) local.tags[name] = tip;

  if (!updated.length && !copied.length) {
    return {
      ok: true,
      level: 'info',
      message: 'Already up to date.',
      explain: `Nothing new on \`${REMOTE_NAME}\`. Your remote-tracking refs already match the remote.`,
      effects: ctx.effects,
    };
  }
  return {
    ok: true,
    level: 'success',
    message: `From ${REMOTE_NAME}\n   ${updated.join(', ') || 'refs up to date'}`,
    explain: `\`fetch\` downloaded ${copied.length} commit(s) and moved the **remote-tracking refs** (${updated.join(', ')}). Your own branches did **not** move — fetch is always safe. Merge or rebase afterwards to integrate the work.`,
    effects: ctx.effects,
  };
}

function doPush(ctx: Ctx, cmd: Command): Omit<ApplyResult, 'world'> {
  const { world } = ctx;
  const local = world.local;
  const remote = world.remote;
  const branch = cmd.name ?? headBranch(local);
  if (!branch) throw new GitError('fatal: you are on a detached HEAD, nothing to push');
  const localTip = local.branches[branch];
  if (!localTip) {
    throw new GitError(
      `error: src refspec ${branch} does not match any`,
      `The branch \`${branch}\` has no commits yet, so there is nothing to send.`,
    );
  }
  const remoteTip = remote.branches[branch];

  if (remoteTip && remoteTip !== localTip) {
    // Ancestry has to be judged on the union of both graphs: the local repo may
    // not even know about the commits that are already on the remote.
    const union: RepoState = { ...local, commits: { ...remote.commits, ...local.commits } };
    if (!isAncestor(union, remoteTip, localTip) && !cmd.force) {
      return {
        ok: false,
        level: 'error',
        message:
          ` ! [rejected]        ${branch} -> ${branch} (fetch first)\nhint: Updates were rejected because the remote contains work that you do not have locally.`,
        explain: `The remote tip \`${remoteTip}\` is **not** an ancestor of your tip \`${localTip}\`, so accepting the push would drop somebody else's commits. Run \`pull\` (fetch + merge/rebase) and push again. \`push --force\` would overwrite the remote — rarely what you want on a shared branch.`,
        effects: ctx.effects,
      };
    }
  }

  const copied = transferCommits(local, remote, [localTip]);
  ctx.effects.transferredCommits.push(...copied);
  const forced = remoteTip && !isAncestor(remote, remoteTip, localTip);
  remote.branches[branch] = localTip;
  local.remoteRefs[`${REMOTE_NAME}/${branch}`] = localTip;
  world.upstream[branch] = `${REMOTE_NAME}/${branch}`;
  ctx.effects.movedRefs.push(branch, `${REMOTE_NAME}/${branch}`);

  if (!copied.length && remoteTip === localTip) {
    return {
      ok: true,
      level: 'info',
      message: 'Everything up-to-date',
      explain: `\`${REMOTE_NAME}/${branch}\` already points at \`${localTip}\`.`,
      effects: ctx.effects,
    };
  }
  return {
    ok: true,
    level: 'success',
    message: `To ${REMOTE_NAME}\n   ${remoteTip ?? '[new branch]'}..${localTip}  ${branch} -> ${branch}${forced ? ' (forced update)' : ''}`,
    explain: `${copied.length} commit(s) were uploaded and the remote branch \`${branch}\` now points at \`${localTip}\`. Your local \`${REMOTE_NAME}/${branch}\` is updated at the same time, because it is a bookmark of *where the remote was the last time you talked to it*.${forced ? ' This was a **forced** update: commits that were only on the remote are now unreachable there.' : ''}`,
    effects: ctx.effects,
  };
}

function doPull(ctx: Ctx, cmd: Command): Omit<ApplyResult, 'world'> {
  const local = ctx.world.local;
  const current = headBranch(local);
  if (!current) throw new GitError('fatal: you are on a detached HEAD, nothing to pull');
  // `git pull [remote] [branch]` always integrates *into the current branch*.
  const remoteBranch = cmd.name ?? current;

  const fetched = doFetch(ctx);
  const trackingName = `${REMOTE_NAME}/${remoteBranch}`;
  const target = local.remoteRefs[trackingName];
  if (!target) {
    return {
      ok: true,
      level: 'warn',
      message: `There is no branch '${remoteBranch}' on ${REMOTE_NAME} yet.`,
      explain: `Nothing to integrate — the remote has no \`${remoteBranch}\`. Push first to create it.`,
      effects: ctx.effects,
    };
  }

  if (!local.branches[current]) {
    local.branches[current] = target;
    ctx.world.upstream[current] = trackingName;
    ctx.effects.movedRefs.push(current);
    return {
      ok: true,
      level: 'success',
      message: `${fetched.message}\nBranch '${current}' created at ${target}`,
      explain: `Fetched the remote work and created \`${current}\` at \`${target}\`.`,
      effects: ctx.effects,
    };
  }

  const integrate = cmd.rebase
    ? doRebase(ctx, { ...cmd, kind: 'rebase', ref: trackingName })
    : doMerge(ctx, { ...cmd, kind: 'merge', ref: trackingName });

  return {
    ok: integrate.ok,
    level: integrate.level,
    message: `${fetched.message}\n${integrate.message}`,
    explain: `**pull = fetch + ${cmd.rebase ? 'rebase' : 'merge'}.** First the remote-tracking ref \`${trackingName}\` was updated, then your current branch \`${current}\` was ${cmd.rebase ? 'replayed on top of it' : 'merged with it'}.\n\n${integrate.explain}`,
    effects: ctx.effects,
  };
}

// ---------------------------------------------------------------------------

const REMOTE_ONLY_BLOCKED: Record<string, string> = {
  push: 'The remote pushes to nobody — run `push` from the local repository.',
  pull: 'The remote pulls from nobody — run `pull` from the local repository.',
  fetch: 'The remote fetches from nobody — run `fetch` from the local repository.',
};

export function applyCommand(world: World, cmd: Command): ApplyResult {
  const next = cloneWorld(world);
  const ctx: Ctx = { world: next, repo: repoOf(next, cmd.repo), effects: emptyEffects() };

  try {
    if (cmd.repo === 'remote' && cmd.kind in REMOTE_ONLY_BLOCKED) {
      throw new GitError(`fatal: \`${cmd.kind}\` cannot run on the remote`, REMOTE_ONLY_BLOCKED[cmd.kind]);
    }
    let res: Omit<ApplyResult, 'world'>;
    switch (cmd.kind) {
      case 'commit': res = doCommit(ctx, cmd); break;
      case 'branch': res = doBranch(ctx, cmd); break;
      case 'checkout': res = doCheckout(ctx, cmd); break;
      case 'merge': res = doMerge(ctx, cmd); break;
      case 'rebase': res = doRebase(ctx, cmd); break;
      case 'tag': res = doTag(ctx, cmd); break;
      case 'reset': res = doReset(ctx, cmd); break;
      case 'fetch': res = doFetch(ctx); break;
      case 'push': res = doPush(ctx, cmd); break;
      case 'pull': res = doPull(ctx, cmd); break;
      default: throw new GitError(`unsupported command`);
    }
    return { ...res, world: res.ok ? next : world, effects: ctx.effects };
  } catch (err) {
    const gitErr = err as GitError;
    return {
      world,
      ok: false,
      level: 'error',
      message: gitErr.message,
      explain: gitErr.explain || 'The command failed, so the repositories are unchanged.',
      effects: emptyEffects(),
    };
  }
}

/** Status summary used by the UI headers. */
export function branchStatus(world: World): string | undefined {
  const local = world.local;
  const branch = headBranch(local);
  if (!branch) return undefined;
  const tracking = world.upstream[branch] ?? `${REMOTE_NAME}/${branch}`;
  const remoteTip = local.remoteRefs[tracking];
  if (!remoteTip) return undefined;
  const { ahead, behind } = commitsAheadBehind(local, local.branches[branch], remoteTip);
  if (!ahead && !behind) return `up to date with ${tracking}`;
  const parts: string[] = [];
  if (ahead) parts.push(`${ahead} ahead`);
  if (behind) parts.push(`${behind} behind`);
  return `${parts.join(', ')} of ${tracking}`;
}

export { resolveRef };
