interface Props {
  direction: 'up' | 'down' | 'idle';
  label: string;
}

/** The strip between the remote and the local panel; lights up on push/fetch/pull. */
export function TransferStrip({ direction, label }: Props) {
  return (
    <div className={`transfer transfer-${direction}`}>
      <div className="transfer-line" />
      <div className="transfer-badge">
        <span className="transfer-arrow">{direction === 'up' ? '↑' : direction === 'down' ? '↓' : '↕'}</span>
        <span>{label}</span>
      </div>
      <div className="transfer-line" />
    </div>
  );
}
