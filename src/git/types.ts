export type CommitId = string;

export interface Commit {
  id: CommitId;
  parents: CommitId[];
  message: string;
  /** Global creation order across the whole world. Parents always have a lower seq. */
  seq: number;
  /** Branch the commit was authored on. Drives lane placement + colour. */
  lane: string;
  /** Where the commit was originally authored, used for teaching hints. */
  origin: RepoKind;
}

export type RepoKind = 'local' | 'remote';

export type Head =
  | { type: 'branch'; branch: string }
  | { type: 'detached'; commit: CommitId };

export interface RepoState {
  kind: RepoKind;
  label: string;
  commits: Record<CommitId, Commit>;
  /** Local branches, e.g. `main`, `feature`. */
  branches: Record<string, CommitId>;
  /** Remote-tracking refs, e.g. `origin/main`. Only populated on the local repo. */
  remoteRefs: Record<string, CommitId>;
  tags: Record<string, CommitId>;
  head: Head;
}

export interface World {
  local: RepoState;
  remote: RepoState;
  /** Monotonic counter used for commit ids + ordering. */
  seq: number;
  /** local branch -> remote-tracking ref (`main` -> `origin/main`). */
  upstream: Record<string, string>;
}

export type CommandKind =
  | 'commit'
  | 'branch'
  | 'checkout'
  | 'merge'
  | 'rebase'
  | 'tag'
  | 'reset'
  | 'fetch'
  | 'push'
  | 'pull';

export interface Command {
  kind: CommandKind;
  /** Which repository the command acts on. `remote` simulates a teammate. */
  repo: RepoKind;
  /** Original source text of the command. */
  source: string;
  message?: string;
  name?: string;
  ref?: string;
  startPoint?: string;
  create?: boolean;
  force?: boolean;
  noFF?: boolean;
  rebase?: boolean;
}

export interface ScriptLine {
  /** Zero-based index within the raw text. */
  lineNumber: number;
  source: string;
  command?: Command;
  error?: string;
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface StepEffects {
  newCommits: CommitId[];
  transferredCommits: CommitId[];
  movedRefs: string[];
  orphanedCommits: CommitId[];
}

export interface ApplyResult {
  world: World;
  ok: boolean;
  level: LogLevel;
  /** One-line result, styled like git's own output. */
  message: string;
  /** Teaching explanation shown in the side panel. */
  explain: string;
  effects: StepEffects;
}

export interface Step {
  /** State *after* this command ran. */
  world: World;
  command: Command;
  result: Omit<ApplyResult, 'world'>;
}

export class GitError extends Error {
  explain: string;
  constructor(message: string, explain = '') {
    super(message);
    this.name = 'GitError';
    this.explain = explain;
  }
}
