import { useCallback, useEffect, useMemo, useState } from 'react';
import { branchStatus } from './git/engine';
import { parseScript } from './git/parser';
import { REMOTE_NAME } from './git/repo';
import { buildTimeline, worldAt } from './git/timeline';
import { computeLayoutContext } from './layout/layout';
import { AboutModal } from './components/AboutModal';
import { CommandPalette } from './components/CommandPalette';
import { ExplanationPanel } from './components/ExplanationPanel';
import { Logo } from './components/Logo';
import { RepoPanel } from './components/RepoPanel';
import { ScriptEditor } from './components/ScriptEditor';
import { Toolbar } from './components/Toolbar';
import { TransferStrip } from './components/TransferStrip';
import { DEFAULT_SCENARIO, SCENARIOS } from './scenarios';

function encodeScript(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeScript(value: string): string | undefined {
  try {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return undefined;
  }
}

function initialScript(): { script: string; scenarioId: string } {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const shared = hash.get('s');
  if (shared) {
    const decoded = decodeScript(shared);
    if (decoded) return { script: decoded, scenarioId: 'custom' };
  }
  return { script: DEFAULT_SCENARIO.script, scenarioId: DEFAULT_SCENARIO.id };
}

export default function App() {
  const start = useMemo(() => initialScript(), []);
  const [script, setScript] = useState(start.script);
  const [scenarioId, setScenarioId] = useState(start.scenarioId);
  const [stepIndex, setStepIndex] = useState(0);
  const [playRequested, setPlayRequested] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [copied, setCopied] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const lines = useMemo(() => parseScript(script), [script]);
  const timeline = useMemo(() => buildTimeline(lines), [lines]);
  const total = timeline.entries.length;

  // Derived rather than stored, so editing the script can only ever shorten the
  // timeline under the playhead — it never needs a corrective render.
  const step = Math.min(stepIndex, total);
  const playing = playRequested && step < total;

  const world = worldAt(timeline, step);
  const entry = step > 0 ? timeline.entries[step - 1] : undefined;
  const layoutCtx = useMemo(() => computeLayoutContext(world), [world]);

  const effects = entry?.result.effects;
  const newCommits = useMemo(() => new Set(effects?.newCommits ?? []), [effects]);
  const transferred = useMemo(() => new Set(effects?.transferredCommits ?? []), [effects]);
  const movedRefs = useMemo(() => new Set(effects?.movedRefs ?? []), [effects]);

  const kind = entry?.line.command?.kind;
  const direction = kind === 'push' ? 'up' : kind === 'fetch' || kind === 'pull' ? 'down' : 'idle';
  const stripLabel =
    direction === 'up'
      ? `push → ${REMOTE_NAME}`
      : direction === 'down'
        ? `${kind} ← ${REMOTE_NAME}`
        : `${REMOTE_NAME} — the network boundary`;

  const goto = useCallback(
    (index: number) => setStepIndex(Math.max(0, Math.min(index, total))),
    [total],
  );

  const togglePlay = () => {
    if (!playRequested && step >= total) setStepIndex(0);
    setPlayRequested((p) => !p);
  };

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setStepIndex((i) => Math.min(i + 1, total)), speed);
    return () => clearTimeout(t);
  }, [playing, step, total, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goto(step + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goto(step - 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlayRequested((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goto, step]);

  const changeScript = (value: string) => {
    setScript(value);
    setScenarioId('custom');
    setPlayRequested(false);
  };

  const pickScenario = (id: string) => {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) return;
    setScript(scenario.script);
    setScenarioId(scenario.id);
    setStepIndex(0);
    setPlayRequested(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const insertCommand = (text: string) => {
    const raw = script.split('\n');
    const at = entry ? entry.line.lineNumber + 1 : 0;
    raw.splice(at, 0, text);
    setScript(raw.join('\n'));
    setScenarioId('custom');
    setStepIndex(step + 1);
    setPlayRequested(false);
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#s=${encodeScript(script)}`;
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const scenario = SCENARIOS.find((s) => s.id === scenarioId);

  return (
    <div className="app">
      <header className="topbar">
        <Logo markSize={38} />
        <div className="topbar-actions">
          <select
            className="scenario-select"
            value={scenarioId}
            onChange={(e) => pickScenario(e.target.value)}
          >
            {scenarioId === 'custom' && <option value="custom">custom scenario</option>}
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <button className="ghost" onClick={share}>
            {copied ? 'link copied ✓' : 'share link'}
          </button>
          <button className="ghost" onClick={() => setAboutOpen(true)}>
            about
          </button>
        </div>
      </header>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}

      <main className="main">
        <aside className="sidebar">
          <ScriptEditor
            script={script}
            onScriptChange={changeScript}
            entries={timeline.entries}
            stepIndex={step}
            onJump={goto}
          />
          <CommandPalette world={world} onInsert={insertCommand} />
        </aside>

        <div className="stage">
          <Toolbar
            stepIndex={step}
            total={total}
            playing={playing}
            speed={speed}
            onStepChange={goto}
            onTogglePlay={togglePlay}
            onSpeedChange={setSpeed}
          />

          {scenario && <p className="scenario-blurb">{scenario.blurb}</p>}

          <RepoPanel
            repo={world.remote}
            ctx={layoutCtx}
            title={`${REMOTE_NAME} · remote repository`}
            hint="what the team shares"
            newCommits={newCommits}
            transferred={transferred}
            movedRefs={movedRefs}
          />

          <TransferStrip direction={direction} label={stripLabel} />

          <RepoPanel
            repo={world.local}
            ctx={layoutCtx}
            title="your local repository"
            hint="where you commit"
            status={branchStatus(world)}
            newCommits={newCommits}
            transferred={transferred}
            movedRefs={movedRefs}
          />

          <ExplanationPanel entry={entry} />

          <footer className="legend">
            <span>
              <i className="key key-branch" /> local branch
            </span>
            <span>
              <i className="key key-remote" /> remote-tracking ref
            </span>
            <span>
              <i className="key key-tag" /> tag
            </span>
            <span>
              <i className="key key-orphan" /> unreachable commit
            </span>
            <span className="muted">← → step · space play/pause</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
