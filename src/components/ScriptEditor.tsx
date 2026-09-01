import type { TimelineEntry } from '../git/timeline';

interface Props {
  script: string;
  onScriptChange: (value: string) => void;
  entries: TimelineEntry[];
  stepIndex: number;
  onJump: (index: number) => void;
}

export function ScriptEditor({ script, onScriptChange, entries, stepIndex, onJump }: Props) {
  return (
    <div className="editor">
      <div className="panel-title">
        <h3>Scenario script</h3>
        <span className="muted">one command per line · # for comments</span>
      </div>

      <textarea
        className="script-input"
        spellCheck={false}
        value={script}
        onChange={(e) => onScriptChange(e.target.value)}
      />

      <div className="panel-title">
        <h3>Steps</h3>
        <span className="muted">click to jump</span>
      </div>

      <ol className="steps">
        <li>
          <button className={`step step-start${stepIndex === 0 ? ' is-current' : ''}`} onClick={() => onJump(0)}>
            <span className="step-num">0</span>
            <span className="step-src">start — empty repositories</span>
          </button>
        </li>
        {entries.map((entry, i) => {
          const n = i + 1;
          const state = n === stepIndex ? 'is-current' : n < stepIndex ? 'is-done' : 'is-pending';
          const failed = !entry.result.ok;
          return (
            <li key={`${entry.line.lineNumber}-${i}`}>
              <button className={`step ${state}${failed ? ' is-failed' : ''}`} onClick={() => onJump(n)}>
                <span className="step-num">{n}</span>
                <span className="step-src">
                  {entry.line.command?.repo === 'remote' && <span className="tag-remote">remote</span>}
                  {entry.line.source.trim().replace(/^remote\s+/, '')}
                </span>
                {failed && <span className="step-flag">!</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
