import { useState } from 'react';
import type { World } from '../git/types';
import { REMOTE_NAME, headBranch } from '../git/repo';

interface Props {
  world: World;
  onInsert: (command: string) => void;
}

function RefSelect({
  label,
  options,
  onPick,
  title,
}: {
  label: string;
  options: string[];
  onPick: (value: string) => void;
  title: string;
}) {
  return (
    <select
      className="palette-select"
      title={title}
      value=""
      disabled={!options.length}
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
        e.target.value = '';
      }}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function CommandPalette({ world, onInsert }: Props) {
  const [branchSeed, setBranchSeed] = useState(1);
  const local = world.local;
  const current = headBranch(local);
  const branches = Object.keys(local.branches);
  const others = branches.filter((b) => b !== current);
  const mergeSources = [...others, ...Object.keys(local.remoteRefs)];
  const remoteBranches = Object.keys(world.remote.branches);

  const newBranchName = () => {
    let name = `feature-${branchSeed}`;
    let n = branchSeed;
    while (branches.includes(name)) {
      n += 1;
      name = `feature-${n}`;
    }
    setBranchSeed(n + 1);
    return name;
  };

  return (
    <div className="palette">
      <div className="panel-title">
        <h3>Add a step</h3>
        <span className="muted">inserts at the playhead</span>
      </div>

      <div className="palette-group">
        <span className="palette-label">local</span>
        <button onClick={() => onInsert('commit')}>commit</button>
        <button onClick={() => onInsert(`checkout -b ${newBranchName()}`)}>checkout -b</button>
        <button onClick={() => onInsert(`branch ${newBranchName()}`)}>branch</button>
        <RefSelect
          label="checkout…"
          title="Switch HEAD to another branch"
          options={[...others, ...Object.keys(local.remoteRefs)]}
          onPick={(v) => onInsert(`checkout ${v}`)}
        />
        <RefSelect
          label="merge…"
          title="Merge another branch into the current one"
          options={mergeSources}
          onPick={(v) => onInsert(`merge ${v}`)}
        />
        <RefSelect
          label="rebase…"
          title="Replay the current branch on top of another"
          options={mergeSources}
          onPick={(v) => onInsert(`rebase ${v}`)}
        />
        <button onClick={() => onInsert('tag v1.0')}>tag</button>
        <RefSelect
          label="reset…"
          title="Move the current branch pointer"
          options={['HEAD~1', 'HEAD~2', ...others]}
          onPick={(v) => onInsert(`reset ${v}`)}
        />
      </div>

      <div className="palette-group">
        <span className="palette-label">network</span>
        <button onClick={() => onInsert('fetch')}>fetch</button>
        <button onClick={() => onInsert('pull')}>pull</button>
        <button onClick={() => onInsert('pull --rebase')}>pull --rebase</button>
        <button onClick={() => onInsert('push')}>push</button>
        <button onClick={() => onInsert('push --force')}>push --force</button>
      </div>

      <div className="palette-group">
        <span className="palette-label">{REMOTE_NAME} (teammate)</span>
        <button onClick={() => onInsert('remote commit')}>remote commit</button>
        <RefSelect
          label="remote checkout…"
          title="Move the remote's HEAD, e.g. to commit on another branch"
          options={remoteBranches}
          onPick={(v) => onInsert(`remote checkout ${v}`)}
        />
        <button onClick={() => onInsert(`remote branch ${newBranchName()}`)}>remote branch</button>
      </div>
    </div>
  );
}
