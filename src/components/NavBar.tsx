'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Shield, User } from 'lucide-react';

export default function NavBar({ title, role }: { title: string; role: string }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        padding: '14px 24px',
        background: 'rgba(13, 21, 38, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Logo / Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px var(--primary-glow)',
        }}>
          <Shield size={16} color="#fff" />
        </div>
        <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em', color: 'var(--text)' }}>
          {title}
        </span>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px',
          borderRadius: 999,
          background: role === 'admin' ? 'var(--purple-dim)' : 'var(--primary-dim)',
          border: `1px solid ${role === 'admin' ? 'rgba(167,139,250,0.25)' : 'rgba(79,141,255,0.25)'}`,
          fontSize: '0.8rem', fontWeight: 600,
          color: role === 'admin' ? 'var(--purple)' : 'var(--primary)',
        }}>
          <User size={12} />
          {role === 'admin' ? '管理员' : '员工'}
        </div>
        <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
          <LogOut size={13} /> 退出
        </button>
      </div>
    </nav>
  );
}
