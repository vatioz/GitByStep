import type { RepoState } from '../git/types';
import { describeHead, isUnborn } from '../git/repo';
import type { LayoutContext } from '../layout/layout';
import { GraphView } from './GraphView';

interface Props {
  repo: RepoState;
  ctx: LayoutContext;
  title: string;
  hint: string;
  status?: string;
  newCommits: Set<string>;
  transferred: Set<string>;
  movedRefs: Set<string>;
}

export function RepoPanel({ repo, ctx, title, hint, status, newCommits, transferred, movedRefs }: Props) {
  const commitCount = Object.keys(repo.commits).length;
  const branches = Object.keys(repo.branches);

  return (
    <section className={`repo-panel repo-${repo.kind}`}>
      <header className="repo-head">
        <div className="repo-title">
          <span className={`repo-dot repo-dot-${repo.kind}`} />
          <h2>{title}</h2>
          <span className="repo-hint">{hint}</span>
        </div>
        <div className="repo-meta">
          <span className="chip">
            HEAD: <strong>{describeHead(repo)}</strong>
            {isUnborn(repo) && ' (unborn)'}
          </span>
          <span className="chip">
            {commitCount} commit{commitCount === 1 ? '' : 's'}
          </span>
          <span className="chip">
            {branches.length} branch{branches.length === 1 ? '' : 'es'}
          </span>
          {status && <span className="chip chip-status">{status}</span>}
        </div>
      </header>
      <GraphView
        repo={repo}
        ctx={ctx}
        newCommits={newCommits}
        transferred={transferred}
        movedRefs={movedRefs}
      />
    </section>
  );
}
