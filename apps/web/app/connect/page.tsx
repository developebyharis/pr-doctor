'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { hasStoredSession, readRepo, saveRepo, saveToken } from '@/lib/token-store';

const C = {
  bg: '#E9ECEF',
  chart: '#FFFFFF',
  ink: '#14181C',
  muted: '#68757F',
  rule: '#D2D8DD',
  ruleStrong: '#AEB8C0',
  plex: '#24408E',
  plexWash: '#EDF0F8',
  block: '#B3261E',
  clear: '#1F6B45',
};

const mono: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

const inputStyle: React.CSSProperties = {
  ...mono,
  fontSize: 13,
  padding: '10px 12px',
  border: `1px solid ${C.ruleStrong}`,
  background: C.chart,
  color: C.ink,
  width: '100%',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  ...mono,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: C.muted,
  marginBottom: 6,
  display: 'block',
};

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: C.muted, ...style }}>
      {children}
    </div>
  );
}

export default function ConnectPage() {
  const router = useRouter();
  const [existing] = useState(() => hasStoredSession());
  const [token, setToken] = useState('');
  const [repoInput, setRepoInput] = useState(() => {
    try { return readRepo(); } catch { return ''; }
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  // Already connected — skip the form and go straight to the PR list.
  useEffect(() => {
    if (existing) {
      router.push('/pulls');
    }
  }, [existing, router]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = repoInput.trim();
    const parts = trimmed.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setError('Repository must be in owner/repo format (e.g. facebook/react)');
      return;
    }

    if (!token.trim()) {
      setError('GitHub token is required');
      return;
    }

    setConnecting(true);
    try {
      const [owner, repo] = parts;
      const res = await fetch(
        `/api/github/direct-prs?token=${encodeURIComponent(token.trim())}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&page=1&per_page=1`,
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `GitHub API error ${res.status}`);
      }

      await saveToken(token.trim());
      saveRepo(trimmed);
      router.push('/pulls');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: '"IBM Plex Sans", system-ui, sans-serif', color: C.ink }}>

      {/* Nav */}
      <header style={{ background: C.chart, borderBottom: `1px solid ${C.ruleStrong}`, padding: '0 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ ...mono, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', color: C.plex, textDecoration: 'none' }}>
            PR Doctor
          </Link>
          <Eyebrow>Connect to GitHub</Eyebrow>
        </div>
      </header>

      {existing ? (
        <div style={{ maxWidth: 760, margin: '48px auto 0', padding: '0 24px 80px' }}>
          <div style={{ padding: '24px', background: C.chart, border: `1px solid ${C.ruleStrong}`, ...mono, fontSize: 13, color: C.muted }}>
            Already connected to <strong style={{ color: C.plex }}>{readRepo() || 'this repository'}</strong> — redirecting to your pull requests…
          </div>
        </div>
      ) : (
      <div style={{ maxWidth: 760, margin: '48px auto 0', padding: '0 24px 80px' }}>

        <Eyebrow style={{ marginBottom: 10 }}>Step 1 of 2</Eyebrow>
        <h1 style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif', fontWeight: 700, fontSize: 28, margin: '0 0 6px', lineHeight: 1.15 }}>
          Connect your GitHub repository
        </h1>
        <p style={{ fontSize: 14, color: C.muted, margin: '0 0 32px', lineHeight: 1.6 }}>
          Enter a <strong style={{ color: C.ink }}>GitHub personal access token</strong> and the{' '}
          <strong style={{ color: C.ink }}>owner/repo</strong> to fetch open pull requests directly from the GitHub API.
        </p>

        <form onSubmit={handleConnect}>
          <div style={{ background: C.chart, border: `1px solid ${C.ruleStrong}` }}>

            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.rule}` }}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>GitHub Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  style={inputStyle}
                  autoComplete="off"
                />
              </div>
              <div>
                <label style={labelStyle}>Repository (owner/repo)</label>
                <input
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="facebook/react"
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.rule}`, ...mono, fontSize: 12, color: C.block }}>
                {error}
              </div>
            )}

            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Link href="/" style={{ ...mono, fontSize: 12, color: C.muted, textDecoration: 'none', padding: '10px 0', letterSpacing: '0.04em' }}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={connecting}
                style={{
                  background: connecting ? C.muted : C.plex,
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 28px',
                  ...mono,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  cursor: connecting ? 'not-allowed' : 'pointer',
                }}
              >
                {connecting ? 'Connecting…' : 'Connect & List PRs →'}
              </button>
            </div>
          </div>
        </form>

      </div>
      )}
    </div>
  );
}
