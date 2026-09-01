export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  script: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'basics',
    title: '1 · Commits and branches',
    blurb: 'A branch is just a moving pointer. Watch main and feature drift apart, then join.',
    script: `# A branch is only a pointer to a commit.
commit "initial project"
commit "add readme"
branch feature
checkout feature
commit "feature part 1"
commit "feature part 2"
checkout main
commit "hotfix on main"
merge feature`,
  },
  {
    id: 'fast-forward',
    title: '2 · Fast-forward vs merge commit',
    blurb: 'If main never moved, git just slides the pointer forward — no merge commit.',
    script: `commit "initial"
checkout -b feature
commit "work A"
commit "work B"
checkout main
# main has no commits of its own -> fast-forward
merge feature
checkout -b other
commit "work C"
checkout main
commit "main moved on"
# now the histories diverged -> real merge commit
merge other`,
  },
  {
    id: 'push-pull',
    title: '3 · push, fetch and pull',
    blurb: 'origin/main is a bookmark of where the remote was last time you talked to it.',
    script: `commit "initial"
commit "add app"
# nothing on the remote yet
push
commit "local work"
# a teammate pushes to the remote
remote commit "teammate change"
# fetch only updates origin/main, your branch stays put
fetch
# merge brings the remote work into your branch
merge origin/main
push`,
  },
  {
    id: 'rejected',
    title: '4 · Why push gets rejected',
    blurb: 'The classic "Updates were rejected" and how pull fixes it.',
    script: `commit "initial"
push
commit "my work"
remote commit "colleague work"
# rejected: the remote has commits you do not have
push
# pull = fetch + merge -> creates a merge commit
pull
push
# tip: \`pull --rebase\` replays your work instead of merging`,
  },
  {
    id: 'rebase',
    title: '5 · Merge vs rebase',
    blurb: 'Rebase re-creates your commits with new hashes; the originals become unreachable.',
    script: `commit "initial"
checkout -b feature
commit "feature 1"
commit "feature 2"
checkout main
commit "main 1"
checkout feature
# replay feature commits on top of main
rebase main
checkout main
merge feature`,
  },
  {
    id: 'team',
    title: '6 · Full team flow',
    blurb: 'Feature branch, a teammate moving main, rebase onto origin/main, force-push, merge, tag.',
    script: `commit "scaffold"
push
checkout -b feature/login
commit "login form"
commit "validation"
push feature/login
# meanwhile a teammate pushes to main
remote checkout main
remote commit "docs update"
remote checkout feature/login
# your feature is based on an outdated main
fetch
rebase origin/main
# the rewritten commits need a forced push
push feature/login
push feature/login --force
checkout main
pull
merge feature/login --no-ff
push
tag v1.0`,
  },
  {
    id: 'detached',
    title: '7 · Detached HEAD and reset',
    blurb: 'What "you are in detached HEAD state" really means, and where reset leaves commits.',
    script: `commit "one"
commit "two"
commit "three"
# HEAD points straight at a commit, not at a branch
checkout main~1
commit "experiment"
# switching away leaves the experiment unreachable
checkout main
# reset drops the branch pointer back in history
reset main~2`,
  },
];

export const DEFAULT_SCENARIO = SCENARIOS[0];
