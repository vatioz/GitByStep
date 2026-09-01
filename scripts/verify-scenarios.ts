import { parseScript } from '../src/git/parser';
import { buildTimeline } from '../src/git/timeline';
import { SCENARIOS } from '../src/scenarios';
import { headBranch, reachableCommits } from '../src/git/repo';
import { computeLayoutContext, layoutRepo } from '../src/layout/layout';
import type { RepoState } from '../src/git/types';

function summarize(repo: RepoState): string {
  const branches = Object.entries(repo.branches)
    .map(([n, id]) => `${n}=${id}`)
    .join(' ');
  const remote = Object.entries(repo.remoteRefs)
    .map(([n, id]) => `${n}=${id}`)
    .join(' ');
  const tags = Object.entries(repo.tags)
    .map(([n, id]) => `${n}=${id}`)
    .join(' ');
  const orphans = Object.keys(repo.commits).length - reachableCommits(repo).size;
  return [
    `HEAD:${headBranch(repo) ?? 'detached'}`,
    branches && `br[${branches}]`,
    remote && `rt[${remote}]`,
    tags && `tag[${tags}]`,
    orphans ? `orphans:${orphans}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

let failures = 0;

for (const scenario of SCENARIOS) {
  console.log(`\n=== ${scenario.title} ===`);
  const lines = parseScript(scenario.script);
  for (const l of lines) {
    if (l.error) {
      failures++;
      console.log(`  PARSE FAIL line ${l.lineNumber}: ${l.source} -> ${l.error}`);
    }
  }
  const timeline = buildTimeline(lines);
  timeline.entries.forEach((e, i) => {
    const status = e.result.ok ? '  ok ' : ' FAIL';
    console.log(
      `${status} ${String(i + 1).padStart(2)} ${e.line.source.trim().padEnd(28)} | L ${summarize(e.world.local)}`,
    );
    console.log(`${''.padEnd(37)} | R ${summarize(e.world.remote)}`);
    if (!e.result.ok && !['rejected', 'team'].includes(scenario.id)) failures++;

    // sanity: parents must exist and precede children
    for (const repo of [e.world.local, e.world.remote]) {
      for (const c of Object.values(repo.commits)) {
        for (const p of c.parents) {
          if (!repo.commits[p]) {
            failures++;
            console.log(`   !! missing parent ${p} of ${c.id} in ${repo.kind}`);
          } else if (repo.commits[p].seq >= c.seq) {
            failures++;
            console.log(`   !! parent ${p} not older than ${c.id}`);
          }
        }
      }
    }

    // sanity: layout must produce a node per commit and no NaN
    const ctx = computeLayoutContext(e.world);
    for (const repo of [e.world.local, e.world.remote]) {
      const lay = layoutRepo(repo, ctx);
      if (lay.nodes.length !== Object.keys(repo.commits).length) {
        failures++;
        console.log('   !! layout node count mismatch');
      }
      if (lay.nodes.some((n) => Number.isNaN(n.x) || Number.isNaN(n.y))) {
        failures++;
        console.log('   !! NaN coordinate');
      }
      if (lay.badges.some((b) => Number.isNaN(b.x) || Number.isNaN(b.y))) {
        failures++;
        console.log('   !! NaN badge coordinate');
      }
    }
  });
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} PROBLEM(S)`}`);
process.exit(failures === 0 ? 0 : 1);
