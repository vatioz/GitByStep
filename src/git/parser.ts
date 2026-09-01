import type { Command, CommandKind, RepoKind, ScriptLine } from './types';

const ALIASES: Record<string, CommandKind> = {
  commit: 'commit',
  ci: 'commit',
  branch: 'branch',
  br: 'branch',
  checkout: 'checkout',
  co: 'checkout',
  switch: 'checkout',
  merge: 'merge',
  rebase: 'rebase',
  tag: 'tag',
  reset: 'reset',
  fetch: 'fetch',
  push: 'push',
  pull: 'pull',
};

export const COMMAND_HELP: Record<CommandKind, string> = {
  commit: 'commit [message] — record a new commit on the current branch',
  branch: 'branch <name> [start] — create a pointer, without switching to it',
  checkout: 'checkout [-b] <ref> — move HEAD to a branch, tag or commit',
  merge: 'merge <ref> [--no-ff] — join another branch into the current one',
  rebase: 'rebase <ref> — replay your commits on top of another branch',
  tag: 'tag <name> [ref] — mark a commit with a fixed name',
  reset: 'reset [--hard] <ref> — move the current branch pointer elsewhere',
  fetch: 'fetch — download remote commits and update origin/* refs',
  push: 'push [branch] [--force] — upload the branch to the remote',
  pull: 'pull [branch] [--rebase] — fetch and then integrate',
};

/** Split on whitespace while keeping quoted strings together. */
function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export function parseCommand(source: string): { command?: Command; error?: string } {
  let tokens = tokenize(source.trim());
  if (!tokens.length) return {};

  let repo: RepoKind = 'local';
  if (tokens[0] === 'remote' && tokens.length > 1) {
    repo = 'remote';
    tokens = tokens.slice(1);
  } else if (tokens[0] === 'remote:' || tokens[0] === 'origin:') {
    repo = 'remote';
    tokens = tokens.slice(1);
  }
  if (tokens[0] === 'git') tokens = tokens.slice(1);
  if (!tokens.length) return { error: 'missing command after `remote`' };

  const kind = ALIASES[tokens[0].toLowerCase()];
  if (!kind) return { error: `unknown command \`${tokens[0]}\`` };

  const rest = tokens.slice(1);
  const flags = rest.filter((t) => t.startsWith('-'));
  const args = rest.filter((t) => !t.startsWith('-'));
  const has = (...names: string[]) => flags.some((f) => names.includes(f));
  const cmd: Command = { kind, repo, source: source.trim() };

  switch (kind) {
    case 'commit': {
      const mIndex = rest.findIndex((t) => t === '-m' || t === '--message');
      if (mIndex >= 0 && rest[mIndex + 1]) cmd.message = rest[mIndex + 1];
      else if (args.length) cmd.message = args.join(' ');
      break;
    }
    case 'branch': {
      if (!args.length) return { error: 'branch needs a name: `branch feature`' };
      cmd.name = args[0];
      cmd.startPoint = args[1];
      break;
    }
    case 'checkout': {
      cmd.create = has('-b', '-c', '--create');
      const [ref, start] = args;
      if (!ref) return { error: 'checkout needs a target: `checkout main` or `checkout -b feature`' };
      cmd.ref = ref;
      cmd.startPoint = start;
      break;
    }
    case 'merge': {
      if (!args.length) return { error: 'merge needs a branch: `merge feature`' };
      cmd.ref = args[0];
      cmd.noFF = has('--no-ff');
      break;
    }
    case 'rebase': {
      if (!args.length) return { error: 'rebase needs a base: `rebase main`' };
      cmd.ref = args[0];
      break;
    }
    case 'tag': {
      if (!args.length) return { error: 'tag needs a name: `tag v1.0`' };
      cmd.name = args[0];
      cmd.ref = args[1];
      break;
    }
    case 'reset': {
      if (!args.length) return { error: 'reset needs a target: `reset main~1`' };
      cmd.ref = args[0];
      break;
    }
    case 'push':
    case 'pull': {
      // Allow the real-git form `push origin main`.
      const positional = args[0] === 'origin' ? args.slice(1) : args;
      cmd.name = positional[0];
      cmd.force = has('-f', '--force');
      cmd.rebase = has('-r', '--rebase');
      break;
    }
    case 'fetch':
      break;
  }
  return { command: cmd };
}

export function parseScript(text: string): ScriptLine[] {
  return text.split('\n').map((source, lineNumber) => {
    const trimmed = source.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      return { lineNumber, source };
    }
    const { command, error } = parseCommand(trimmed);
    return { lineNumber, source, command, error };
  });
}

/** Only the lines that actually produce a step. */
export function executableLines(lines: ScriptLine[]): ScriptLine[] {
  return lines.filter((l) => l.command || l.error);
}
