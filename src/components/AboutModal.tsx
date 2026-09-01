import { useEffect } from 'react';
import { LogoMark } from './Logo';
import pkg from '../../package.json';

export function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal about-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="about-header">
          <LogoMark size={44} />
          <div>
            <h2>GitByStep</h2>
            <p className="muted">version {pkg.version}</p>
          </div>
        </div>

        <p>
          An animated, <strong>scriptable</strong> git visualiser for teaching. Unlike Mermaid's{' '}
          <code>gitGraph</code> (static) or similar online tools (fixed scenarios), you write the
          scenario yourself and step through it one command at a time — with a local repository{' '}
          <em>and</em> a remote repository shown side by side, so <code>fetch</code>,{' '}
          <code>push</code> and <code>pull</code> are actually visible instead of implied.
        </p>

        <h3>Goal</h3>
        <p>
          Help learners build an accurate mental model of git by watching commands change a real
          graph, instead of memorising diagrams — every step is a real command, applied to a real
          history, with an explanation of why the graph changed.
        </p>

        <dl className="about-meta">
          <dt>Author</dt>
          <dd>Petr Kubat</dd>
          <dt>License</dt>
          <dd>MIT</dd>
        </dl>
      </div>
    </div>
  );
}
