'use client';

import { useRouter } from 'next/navigation';

export default function NavBar({ title, role }: { title: string, role: string }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <nav className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderRadius: '0 0 12px 12px', padding: '15px 30px' }}>
      <h1 style={{ margin: 0, fontSize: '1.2rem' }}>{title}</h1>
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9em', color: '#cbd5e1' }}>当前角色: {role === 'admin' ? '管理员' : '员工'}</span>
        <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.9em' }}>退出登录</button>
      </div>
    </nav>
  );
}
