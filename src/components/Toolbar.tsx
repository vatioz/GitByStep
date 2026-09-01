interface Props {
  stepIndex: number;
  total: number;
  playing: boolean;
  speed: number;
  onStepChange: (index: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
}

export function Toolbar({
  stepIndex,
  total,
  playing,
  speed,
  onStepChange,
  onTogglePlay,
  onSpeedChange,
}: Props) {
  return (
    <div className="toolbar">
      <div className="transport">
        <button title="Back to start" onClick={() => onStepChange(0)} disabled={stepIndex === 0}>
          ⏮
        </button>
        <button title="Step back" onClick={() => onStepChange(stepIndex - 1)} disabled={stepIndex === 0}>
          ◀
        </button>
        <button className="primary" title={playing ? 'Pause' : 'Play'} onClick={onTogglePlay} disabled={!total}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          title="Step forward"
          onClick={() => onStepChange(stepIndex + 1)}
          disabled={stepIndex >= total}
        >
          ▶
        </button>
        <button title="Jump to end" onClick={() => onStepChange(total)} disabled={stepIndex >= total}>
          ⏭
        </button>
      </div>

      <input
        className="scrubber"
        type="range"
        min={0}
        max={Math.max(total, 1)}
        value={stepIndex}
        onChange={(e) => onStepChange(Number(e.target.value))}
        aria-label="Scenario progress"
      />

      <span className="counter">
        {stepIndex} / {total}
      </span>

      <label className="speed">
        speed
        <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}>
          <option value={1600}>slow</option>
          <option value={1000}>normal</option>
          <option value={550}>fast</option>
        </select>
      </label>
    </div>
  );
}
