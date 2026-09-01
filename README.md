# GitByStep

An animated, **scriptable** git visualiser for teaching. Unlike Mermaid's `gitGraph` (static) or
similar online tools (fixed scenarios), you write the scenario yourself and step through it one
command at a time — with a local repository *and* a remote repository shown side by side, so
`fetch` / `push` / `pull` are actually visible instead of implied.

```
commit "initial project"
branch feature
checkout feature
commit "feature part 1"
checkout main
commit "hotfix"
merge feature
push
```

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/ — deployable to GitHub Pages
npm run verify   # replays every built-in scenario and sanity-checks the graph
```

## What you get

- **Two repositories.** The remote (`origin`) on top, your local clone below. Remote-tracking refs
  (`origin/main`) are drawn in the local panel so learners can see they are a *bookmark*, not the remote.
- **Step / play / scrub.** Every command produces an immutable snapshot, so stepping backwards is free.
  `←` `→` step, `space` plays.
- **Live sandbox.** The command palette inserts a command at the playhead, so you can improvise past
  the end of a scripted scenario.
- **Teaching text.** Each step shows git's real-ish output plus an explanation of *why* the graph
  changed (fast-forward vs merge commit, why a push was rejected, why rebase makes new hashes…).
- **Shareable.** "share link" encodes the whole script in the URL fragment.

## Scenario language

One command per line. `#` or `//` start a comment. Quotes keep a message together. A leading `git`
is accepted and ignored, so you can paste real commands.

| Command | Notes |
| --- | --- |
| `commit [message]` | `commit "add readme"` or `commit -m "add readme"` |
| `branch <name> [start]` | creates a pointer, does not switch |
| `checkout <ref>` / `switch <ref>` | `checkout -b <name>` creates and switches |
| `merge <ref> [--no-ff]` | fast-forwards when possible unless `--no-ff` |
| `rebase <ref>` | replays your commits; originals stay visible but unreachable |
| `tag <name> [ref]` | |
| `reset <ref>` | moves the current branch pointer |
| `fetch` | updates `origin/*` only |
| `push [branch] [--force]` | rejected when the remote has commits you lack |
| `pull [branch] [--rebase]` | fetch + merge, or fetch + rebase |
| `remote <command>` | runs the command on the remote, i.e. simulates a teammate |

Refs accept `~`/`^` suffixes: `main~2`, `HEAD^`.

`remote commit "colleague work"` is the key to interesting scenarios — it is what makes a later
`push` get rejected and a `pull` produce a merge commit.

## Adding your own scenarios

Add an entry to `src/scenarios.ts`:

```ts
{
  id: 'my-lesson',
  title: '8 · Something I keep explaining',
  blurb: 'One sentence shown above the graphs.',
  script: `commit "start"
push
...`,
}
```

Then run `npm run verify` — it replays every scenario and fails on unexpected errors, broken parent
links or bad layout coordinates. Scenarios that are *meant* to contain a failing command (a rejected
push) are listed in the allow-list inside `scripts/verify-scenarios.ts`.

## How it is put together

```
src/git/        the model: types, repo helpers, the command engine, DSL parser, timeline
src/layout/     pure graph layout (lanes, x-ranks, bezier edges, ref badges)
src/components/ React views — all presentational
```

`src/git` has no React and no DOM dependency: `applyCommand(world, command)` returns a brand new
world plus a message, an explanation and the effects to highlight. The timeline is just a fold over
the parsed script, which is why scrubbing is instant and why the verify script can run headless.

Layout rules worth knowing if you tweak the visuals: a commit's row comes from the branch it was
authored on (`commit.lane`), lanes are assigned across *both* repositories so a branch keeps the same
row in each panel, and the horizontal step grows to fit the longest ref name so badges never collide.

### Extending to working directory / staging area

`RepoState` is deliberately the only place that knows what a repository contains. To add a working
tree and an index later:

1. add `workingTree` / `index` fields to `RepoState` in `src/git/types.ts`,
2. handle them in the command functions in `src/git/engine.ts` (`add`, `status`, `commit`, `checkout`,
   `reset --soft/--mixed/--hard`),
3. render them as extra boxes inside `RepoPanel`, left of the graph.

Nothing in the layout or timeline code needs to change.
