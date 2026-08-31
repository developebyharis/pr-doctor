'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { hasStoredSession, readRepo, saveRepo, saveToken, readToken, clearToken } from '@/lib/token-store';
import { Shell, mono } from '@/app/components/ui';

const inputStyle: React.CSSProperties = {
  ...mono,
  fontSize: 14,
  padding: '13px 14px',
  border: '1px solid var(--rule-strong)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  width: '100%',
  outline: 'none',
  borderRadius: 'var(--radius-sm)',
  transition: 'border-color .12s ease, box-shadow .12s ease',
  boxShadow: 'var(--shadow-sm)',
};

const labelStyle: React.CSSProperties = {
  ...mono,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--muted)',
  marginBottom: 8,
  display: 'block',
};

export default function ConnectPage() {
  const router = useRouter();
  const [existing] = useState(() => hasStoredSession());
  const [existingRepo] = useState(() => readRepo());
  const [token, setToken] = useState('');
  const [repoInput, setRepoInput] = useState(() => {
    try { return readRepo(); } catch { return ''; }
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = repoInput.trim();
    const parts = trimmed.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setError('Repository must be in owner/repo format (e.g. facebook/react)');
      return;
    }

    // If we're already connected, keep the saved token unless the user typed a new one.
    const existingToken = await readToken();
    const tokenToUse = token.trim() || existingToken;
    if (!tokenToUse) {
      setError('GitHub token is required');
      return;
    }

    setConnecting(true);
    try {
      const [owner, repo] = parts;
      const res = await fetch(
        `/api/github/direct-prs?token=${encodeURIComponent(tokenToUse)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&page=1&per_page=1`,
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `GitHub API error ${res.status}`);
      }

      if (tokenToUse !== existingToken) {
        await saveToken(tokenToUse);
      }
      saveRepo(trimmed);
      window.dispatchEvent(new Event('gh-connected'));
      router.push('/pulls');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    clearToken();
    setToken('');
    setRepoInput('');
    window.dispatchEvent(new Event('gh-disconnected'));
    router.push('/');
  }

  return (
    <Shell footer={false} maxW={760}>
      {/* Header */}
      <div style={{ textAlign: 'center', padding: 'clamp(40px, 6vw, 64px) 0 8px' }}>
        <div className="eyebrow" style={{ color: 'var(--plex)', marginBottom: 12 }}>{existing ? 'Change repository' : 'Connect to GitHub'}</div>
        <h1 className="display" style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '0 0 10px', lineHeight: 1.1 }}>
          {existing ? 'Switch to another repository' : 'Connect your GitHub repository'}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted)', margin: '0 auto', maxWidth: '52ch', lineHeight: 1.6 }}>
          {existing ? (
            <>Currently connected to <strong style={{ color: 'var(--ink)' }}>{existingRepo || 'a repository'}</strong>. Change the{' '}
            <strong style={{ color: 'var(--ink)' }}>owner/repo</strong> below to point PR Doctor at a different repo — your token is kept.</>
          ) : (
            <>Enter a <strong style={{ color: 'var(--ink)' }}>GitHub personal access token</strong> and the{' '}
            <strong style={{ color: 'var(--ink)' }}>owner/repo</strong> to fetch open pull requests
            directly from the GitHub API.</>
          )}
        </p>
      </div>

      <form onSubmit={handleConnect} style={{ marginTop: 32 }}>
          <div className="ui-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: 'clamp(20px, 4vw, 28px)' }}>
              {existing && (
                <div style={{ marginBottom: 20, padding: '12px 14px', border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)', background: '#FAFBFC', ...mono, fontSize: 12, color: 'var(--muted)' }}>
                  Using saved token for <strong style={{ color: 'var(--plex)' }}>{existingRepo || 'current repo'}</strong>. Leave the token blank to keep it.
                </div>
              )}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>GitHub Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={existing ? 'keep current token' : 'ghp_xxxxxxxxxxxx'}
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
              <div style={{ padding: '13px 24px', borderTop: '1px solid var(--rule)', background: 'var(--block-wash)', ...mono, fontSize: 12, color: 'var(--block)' }}>
                {error}
              </div>
            )}

            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '1px solid var(--rule)', background: '#FAFBFC' }}>
              {existing ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="mono"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--block)', letterSpacing: '0.04em', padding: 0 }}
                >
                  Disconnect
                </button>
              ) : (
                <Link href="/" className="mono" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none', letterSpacing: '0.04em' }}>
                  ← Back to home
                </Link>
              )}
              <button
                type="submit"
                disabled={connecting}
                className="btn-hover"
                style={{
                  background: 'var(--plex-bright)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 26px',
                  ...mono,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                  borderRadius: 'var(--radius-sm)',
                  cursor: connecting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 6px 16px rgba(47,91,216,0.28)',
                }}
              >
                {connecting ? 'Checking…' : (existing ? 'Save & switch repo →' : 'Connect & List PRs →')}
              </button>
            </div>
          </div>
        </form>
    </Shell>
  );
}
