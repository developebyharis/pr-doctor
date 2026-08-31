'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { hasStoredSession, readRepo } from '@/lib/token-store';

/* ── Responsive primitives ─────────────────────────────────────────────── */

/** CSS variables used by the modern design system (defined in globals.css). */
export const ui = {
  ground: 'var(--ground)',
  surface: 'var(--surface)',
  ink: 'var(--ink)',
  muted: 'var(--muted)',
  faint: 'var(--faint)',
  rule: 'var(--rule)',
  ruleStrong: 'var(--rule-strong)',
  block: 'var(--block)',
  blockWash: 'var(--block-wash)',
  caution: 'var(--caution)',
  cautionWash: 'var(--caution-wash)',
  clear: 'var(--clear)',
  clearWash: 'var(--clear-wash)',
  plex: 'var(--plex)',
  plexBright: 'var(--plex-bright)',
  plexWash: 'var(--plex-wash)',
  shadowSm: 'var(--shadow-sm)',
  shadowMd: 'var(--shadow-md)',
  shadowLg: 'var(--shadow-lg)',
  radiusSm: 'var(--radius-sm)',
  radius: 'var(--radius)',
  radiusLg: 'var(--radius-lg)',
} as const;

export const mono: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };
export const display: React.CSSProperties = {
  fontFamily: '"IBM Plex Sans Condensed", sans-serif',
  fontWeight: 700,
  letterSpacing: '-0.01em',
};

/** Returns true when the viewport is at or above the given px breakpoint. */
export function useMedia(max: number): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < max : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${max}px)`);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [max]);
  return matches;
}

/* ── Buttons ───────────────────────────────────────────────────────────── */

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'ghost' | 'dark' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

export function Button({
  children, onClick, href, variant = 'primary', size = 'md', style, className, disabled,
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: '"IBM Plex Mono", monospace',
    fontWeight: 600,
    letterSpacing: '0.02em',
    border: 'none',
    cursor: href || onClick ? 'pointer' : 'default',
    textDecoration: 'none',
    borderRadius: 'var(--radius-sm)',
    ...(size === 'lg' && { padding: '13px 26px', fontSize: 14 }),
    ...(size === 'md' && { padding: '10px 20px', fontSize: 13 }),
    ...(size === 'sm' && { padding: '7px 14px', fontSize: 12 }),
    ...(variant === 'primary' && {
      background: 'var(--plex-bright)', color: '#fff', boxShadow: '0 6px 16px rgba(17,17,19,0.16)',
    }),
    ...(variant === 'dark' && { background: 'var(--ink)', color: '#fff' }),
    ...(variant === 'ghost' && {
      background: 'transparent', color: 'var(--plex)', border: '1px solid var(--plex)',
    }),
    ...(variant === 'outline' && {
      background: 'transparent', color: 'var(--ink)', border: '1px solid var(--rule-strong)',
    }),
    ...(disabled && { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' }),
    ...style,
  };

  const el = <span className={`btn-hover ${className ?? ''}`} style={base} onClick={onClick}>{children}</span>;

  if (href) {
    return <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{el}</Link>;
  }
  return el;
}

/* ── Section heading ───────────────────────────────────────────────────── */

export function SectionHeading({
  eyebrow, title, sub, align = 'left', tone = 'light',
}: {
  eyebrow?: string; title: string; sub?: string; align?: 'left' | 'center'; tone?: 'light' | 'dark';
}) {
  const color = tone === 'dark' ? '#fff' : 'var(--ink)';
  const subColor = tone === 'dark' ? 'rgba(255,255,255,0.72)' : 'var(--muted)';
  return (
    <div style={{ textAlign: align, maxWidth: 760, margin: align === 'center' ? '0 auto' : 0, marginBottom: 28 }}>
      {eyebrow && (
        <div className="eyebrow" style={{ color: tone === 'dark' ? 'rgba(255,255,255,0.55)' : 'var(--plex)', marginBottom: 10 }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{ ...display, fontSize: 'clamp(26px, 3.4vw, 40px)', lineHeight: 1.12, color, margin: '0 0 12px' }}>
        {title}
      </h2>
      {sub && <p style={{ fontSize: 15.5, lineHeight: 1.65, color: subColor, margin: 0 }}>{sub}</p>}
    </div>
  );
}

/* ── Responsive site navigation ────────────────────────────────────────── */

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pulls', label: 'Pull requests' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const isMobile = useMedia(860);
  const [connected, setConnected] = useState(() => hasStoredSession());
  const [repo, setRepo] = useState(() => readRepo());

  useEffect(() => {
    const sync = () => {
      setConnected(hasStoredSession());
      setRepo(readRepo());
    };
    window.addEventListener('storage', sync);
    window.addEventListener('gh-connected', sync);
    window.addEventListener('gh-disconnected', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('gh-connected', sync);
      window.removeEventListener('gh-disconnected', sync);
    };
  }, []);

  const connectNode = connected
    ? (
      <Link href="/connect" title="Change repository" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...mono, fontSize: 12, color: '#fff', textDecoration: 'none', background: 'var(--ink)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', letterSpacing: '0.04em', boxShadow: '0 4px 12px rgba(17,17,19,0.18)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5FCF83' }} />
        {repo || 'Connected'}
      </Link>
    )
    : (
      <Link href="/connect" style={{ ...mono, fontSize: 12, color: '#fff', textDecoration: 'none', background: 'var(--ink)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', letterSpacing: '0.04em', boxShadow: '0 4px 12px rgba(17,17,19,0.18)' }}>
        Connect GitHub
      </Link>
    );

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--rule)' }}>
      <div className="container" style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--ink)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"IBM Plex Sans Condensed", sans-serif', fontWeight: 700, fontSize: 15, boxShadow: '0 4px 10px rgba(17,17,19,0.22)' }}>
            PD
          </span>
          <span style={{ ...mono, fontSize: 14, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--ink)' }}>PR Doctor</span>
        </Link>

        {/* Desktop links */}
        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ ...mono, fontSize: 12, color: 'var(--muted)', textDecoration: 'none', letterSpacing: '0.04em', transition: 'color .12s' }}>
              {l.label}
            </Link>
          ))}
          {connectNode}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
          className="show-mobile"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--ink)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {isMobile && open && (
        <div style={{ borderTop: '1px solid var(--rule)', background: 'var(--surface)', padding: '10px 20px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: 'var(--shadow-md)' }}>
          {[...NAV_LINKS, { href: '/connect', label: connected ? (repo || 'Connected') : 'Connect GitHub' }].map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{ ...mono, fontSize: 14, color: 'var(--ink)', textDecoration: 'none', padding: '12px 8px', borderBottom: '1px solid var(--rule)' }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

/* ── Page shell with shared nav + footer ───────────────────────────────── */

export function Shell({ children, footer = true, maxW }: { children: React.ReactNode; footer?: boolean; maxW?: number }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ground)' }}>
      <Nav />
      <main style={{ maxWidth: maxW ?? 'var(--maxw)', margin: '0 auto', padding: '0 20px' }}>
        {children}
      </main>
      {footer && (
        <footer style={{ marginTop: 80, borderTop: '1px solid var(--rule)', background: 'var(--surface)' }}>
          <div className="container" style={{ paddingTop: 28, paddingBottom: 28, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...mono, fontSize: 12, color: 'var(--muted)' }}>PR Doctor · IBM BOB 2.0</span>
            <span className="eyebrow" style={{ color: 'var(--faint)' }}>IBM TechXchange 2026 · Pre-conference Dev Day</span>
          </div>
        </footer>
      )}
    </div>
  );
}
