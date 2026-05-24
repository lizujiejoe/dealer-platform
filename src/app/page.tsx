'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Shield } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登录失败');
      router.push(data.user.role === 'admin' ? '/admin' : '/staff');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', padding: 20,
    }}>
      {/* 背景光效 */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 60% at 50% 40%, rgba(79,141,255,0.08) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* 卡片 */}
        <div className="glass-panel" style={{ padding: 40 }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 16,
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 30px var(--primary-glow)',
            }}>
              <Shield size={28} color="#fff" />
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              车商客户开发平台
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-3)' }}>
              请使用您的账号登录系统
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'var(--danger-dim)', border: '1px solid rgba(255,94,110,0.25)',
              borderRadius: 'var(--radius)', padding: '10px 14px',
              color: 'var(--danger)', fontSize: '0.875rem', marginBottom: 20, textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)' }}>
                用户名
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="请输入用户名"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)' }}>
                密码
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="请输入密码"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-solid"
              disabled={loading}
              style={{ marginTop: 8, padding: '12px', fontSize: '0.95rem', width: '100%', letterSpacing: '0.02em' }}
            >
              {loading
                ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> 登录中...</>
                : <><LogIn size={15} /> 登录系统</>
              }
            </button>
          </form>
        </div>

        {/* 底部版权 */}
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 24 }}>
          内部工具 · 请勿外传账号信息
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
