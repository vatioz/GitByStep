# Contributing to GitByStep

Thanks for taking a look! GitByStep is a small teaching tool, so contributions of all sizes are
welcome — typo fixes, new scenarios, bug reports, or features.

## Getting set up

```bash
npm install
npm run dev      # http://localhost:5173
```

Node 22 is used in CI; anything reasonably recent should work.

## Before opening a PR

```bash
npm run lint     # oxlint
npm run build    # tsc -b && vite build
npm run verify   # replays every built-in scenario and sanity-checks the graph
```

All three should pass. If you add or change a scenario in `src/scenarios.ts`, `npm run verify` is
what catches broken parent links, bad layout coordinates, or unexpected command failures — see the
allow-list in `scripts/verify-scenarios.ts` if a scenario is *meant* to contain a failing command
(e.g. a rejected push).

## Project layout

```
src/git/        the model: types, repo helpers, the command engine, DSL parser, timeline
src/layout/     pure graph layout (lanes, x-ranks, bezier edges, ref badges)
src/components/ React views — all presentational
```

`src/git` has no React or DOM dependency, so the engine and timeline can be tested/verified
headlessly. See the README's "How it is put together" section for more detail.

## Adding a scenario

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

Then run `npm run verify`.

## Reporting bugs / suggesting features

Open a GitHub issue with steps to reproduce (ideally including the scenario script) or a
description of the use case. Screenshots or a share link (the "share link" button encodes the
whole script in the URL) make bug reports much faster to act on.

## Code style

- Keep `src/git` and `src/layout` free of React/DOM dependencies.
- Run `npm run lint` before committing; fix warnings rather than suppressing them.
- Prefer small, focused PRs over large ones.

## License

By contributing, you agree that your contributions will be licensed under the project's
[MIT License](./LICENSE).
