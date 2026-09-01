import type { TimelineEntry } from '../git/timeline';
import { renderRich } from './rich';

interface Props {
  entry?: TimelineEntry;
}

export function ExplanationPanel({ entry }: Props) {
  if (!entry) {
    return (
      <section className="explain">
        <div className="explain-head">
          <span className="explain-cmd muted">no step selected</span>
        </div>
        <p className="explain-body muted">
          Press <strong>▶</strong> to play the scenario, or step through it one command at a time.
        </p>
      </section>
    );
  }

  const { result, line } = entry;
  return (
    <section className={`explain level-${result.level}`}>
      <div className="explain-head">
        <span className="prompt">$ git</span>
        <span className="explain-cmd">{line.source.trim()}</span>
      </div>
      <pre className="explain-output">{result.message}</pre>
      {result.explain.split('\n\n').map((para, i) => (
        <p className="explain-body" key={i}>
          {renderRich(para)}
        </p>
      ))}
    </section>
  );
}
