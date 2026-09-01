import type { SVGProps } from 'react';

export function LogoMark({ size = 36, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="GitByStep Logo"
      {...props}
    >
      <defs>
        <linearGradient id="gbs-react-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#151d2a" />
          <stop offset="100%" stopColor="#090d14" />
        </linearGradient>
        <linearGradient id="gbs-react-trunk" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#2fc4a0" />
          <stop offset="100%" stopColor="#5b9dff" />
        </linearGradient>
        <linearGradient id="gbs-react-branch" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#5b9dff" />
          <stop offset="60%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
        <linearGradient id="gbs-react-border" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#a855f7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Base App Tile */}
      <rect x="1" y="1" width="30" height="30" rx="7.5" fill="url(#gbs-react-bg)" stroke="url(#gbs-react-border)" strokeWidth="1.2" />

      {/* Stepping Grid Lines */}
      <line x1="6" y1="23" x2="26" y2="23" stroke="#ffffff" strokeOpacity="0.06" strokeDasharray="1 3" strokeWidth="1" />
      <line x1="6" y1="16" x2="26" y2="16" stroke="#ffffff" strokeOpacity="0.06" strokeDasharray="1 3" strokeWidth="1" />
      <line x1="6" y1="9" x2="26" y2="9" stroke="#ffffff" strokeOpacity="0.06" strokeDasharray="1 3" strokeWidth="1" />

      {/* Git Graph Branches */}
      <path d="M10 23 V9" stroke="url(#gbs-react-trunk)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M10 16 C12.5 16 16.5 14 22 9" stroke="url(#gbs-react-branch)" strokeWidth="2.6" strokeLinecap="round" fill="none" />

      {/* Step Forward Chevrons */}
      <path d="M14.5 19.5 L18 22.5 L14.5 25.5" stroke="#5b9dff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <path d="M19 19.5 L22.5 22.5 L19 25.5" stroke="#2fc4a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />

      {/* Commit Nodes */}
      <circle cx="10" cy="23" r="3.2" fill="#2fc4a0" stroke="#090d14" strokeWidth="1.6" />
      <circle cx="10" cy="9" r="3.2" fill="#5b9dff" stroke="#090d14" strokeWidth="1.6" />
      <circle cx="22" cy="9" r="3.5" fill="#f43f5e" stroke="#090d14" strokeWidth="1.6" />
      <circle cx="22" cy="9" r="1.3" fill="#ffffff" />
    </svg>
  );
}

export function Logo({
  markSize = 36,
  showTagline = true,
  className = '',
}: {
  markSize?: number;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <div className={`brand ${className}`}>
      <LogoMark size={markSize} className="brand-logo-mark" />
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <span>Git</span>
          <span style={{ color: 'var(--muted)', fontWeight: 400 }}>By</span>
          <span
            style={{
              background: 'linear-gradient(135deg, var(--accent), #c084fc, #f43f5e)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 800,
            }}
          >
            Step
          </span>
        </h1>
        {showTagline && <p>Step through git scenarios instead of staring at a static diagram.</p>}
      </div>
    </div>
  );
}
