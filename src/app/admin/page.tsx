'use client';

import { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import NavBar from '@/components/NavBar';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [totalDealers, setTotalDealers] = useState(0);
  const [unassigned, setUnassigned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // 按城市分配
  const [assignUser, setAssignUser] = useState('');
  const [assignCity, setAssignCity] = useState('');

  // 按条数随机分配
  const [countUser, setCountUser] = useState('');
  const [countNum, setCountNum] = useState('');
  const [countCity, setCountCity] = useState('');

  // 数据总览过滤与勾选
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // 话术管理
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTemplate, setNewTemplate] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, assignRes, dealersRes] = await Promise.all([
        fetch('/api/users', { cache: 'no-store' }),
        fetch('/api/assignments', { cache: 'no-store' }),
        fetch(`/api/dealers?status=${filterStatus}`, { cache: 'no-store' })
      ]);
      const usersData = await usersRes.json();
      const assignData = await assignRes.json();
      const dealersData = await dealersRes.json();

      setUsers(usersData.users || []);
      setStats(assignData.stats || []);
      setCities(dealersData.cities || []);
      setDealers(dealersData.dealers || []);
      setTotalDealers(dealersData.total || 0);
      setSelectedIds([]); // 刷新数据时清空勾选

      // 同步拉取话术
      const tmplRes = await fetch('/api/templates', { cache: 'no-store' });
      const tmplData = await tmplRes.json();
      setTemplates(tmplData.templates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  // 同步计算未分配数量
  useEffect(() => {
    const assignedCount = stats.reduce((sum: number, s: any) => sum + (s.total_assigned || 0), 0);
    // 注意：同一dealer可分配给多人，这里用API返回的实际值
    // 改为专门计算
    fetch('/api/assignments', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const uniqueAssigned = new Set((data.assignments || []).map((a: any) => a.dealer_id));
        setUnassigned(totalDealers - uniqueAssigned.size);
      });
  }, [stats, totalDealers]);

  useEffect(() => {
    fetchData();
  }, [fetchData, filterStatus]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/dealers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: results.data }),
            cache: 'no-store',
          });
          const data = await res.json();
          if (res.ok) {
            showToast(`✅ 成功导入 ${data.imported} 条车商数据！`);
            await fetchData();   // 重新拉取，触发界面刷新
          } else {
            showToast('导入失败: ' + data.error, 'err');
          }
        } catch {
          showToast('导入异常，请重试', 'err');
        } finally {
          setImporting(false);
          e.target.value = '';
        }
      }
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, password: newPassword, role: 'staff' }),
    });
    if (res.ok) {
      showToast(`✅ 员工账号 "${newUsername}" 创建成功`);
      setNewUsername(''); setNewPassword('');
      fetchData();
    } else {
      const d = await res.json();
      showToast('创建失败: ' + d.error, 'err');
    }
  };

  const handleAssignCity = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/assignments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: parseInt(assignUser), city: assignCity }),
    });
    const data = await res.json();
    if (res.ok) {
      const skipped = data.skipped_already_assigned > 0 ? `（跳过 ${data.skipped_already_assigned} 条已分配）` : '';
      showToast(`✅ 成功分配 ${data.assigned} 个 "${assignCity}" 客户 ${skipped}`);
      fetchData();
    } else {
      showToast('分配失败: ' + data.error, 'err');
    }
  };

  const handleAssignCount = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = { user_id: parseInt(countUser), count: parseInt(countNum) };
    if (countCity) body.city = countCity;

    const res = await fetch('/api/assignments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`✅ 随机分配 ${data.assigned} 条，池中剩余未分配：${data.remaining_after} 条`);
      setCountNum('');
      fetchData();
    } else {
      showToast('分配失败: ' + data.error, 'err');
    }
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplate.trim()) return;
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newTemplate }),
    });
    if (res.ok) {
      showToast('✅ 话术添加成功');
      setNewTemplate('');
      fetchData();
    } else {
      const d = await res.json();
      showToast('添加失败: ' + d.error, 'err');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('确认删除该话术？')) return;
    const res = await fetch('/api/templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      showToast('✅ 话术已删除');
      fetchData();
    } else {
      const d = await res.json();
      showToast(d.error, 'err');
    }
  };

  const handleSaveEdit = async (id: number) => {
    const res = await fetch('/api/templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content: editingContent }),
    });
    if (res.ok) {
      showToast('✅ 话术已更新');
      setEditingId(null);
      fetchData();
    } else {
      showToast('更新失败', 'err');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`警告：确定要彻底删除选中的 ${selectedIds.length} 条车商数据吗？\n该操作不可恢复，且会同步删除关联的员工跟进记录！`)) {
      return;
    }
    
    try {
      const res = await fetch('/api/dealers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      
      if (res.ok) {
        showToast(`✅ 成功删除 ${data.deleted} 条数据`);
        fetchData();
      } else {
        showToast(`删除失败: ${data.error}`, 'err');
      }
    } catch (err) {
      showToast('删除异常', 'err');
    }
  };

  if (loading) return <div style={{ padding: 40, color: 'white', textAlign: 'center' }}>加载中...</div>;

  const staffUsers = users.filter(u => u.role === 'staff');

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '0 20px 40px' }}>
      <NavBar title="管理后台" role="admin" />

      {/* Toast 通知 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000,
          background: toast.type === 'ok' ? '#065f46' : '#7f1d1d',
          border: `1px solid ${toast.type === 'ok' ? '#10b981' : '#ef4444'}`,
          padding: '12px 20px', borderRadius: 8, color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', maxWidth: 400,
          transition: 'all 0.3s',
        }}>
          {toast.msg}
        </div>
      )}

      {/* 顶部概览卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '数据库车商总数', value: totalDealers, color: '#3b82f6' },
          { label: '未分配给任何人', value: unassigned, color: '#10b981' },
          { label: '员工账号数', value: staffUsers.length, color: '#f59e0b' },
        ].map(card => (
          <div key={card.label} className="glass-panel" style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: '0.85em', color: '#cbd5e1', marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* 1. CSV 导入 */}
        <div className="glass-panel">
          <h3 style={{ marginTop: 0 }}>1. 导入数据 (CSV)</h3>
          <p style={{ fontSize: '0.9em', color: '#cbd5e1', margin: '0 0 14px' }}>支持多次上传，相同 place_id 会自动覆盖更新。</p>
          <label style={{
            display: 'inline-block', padding: '8px 16px', borderRadius: 6,
            background: importing ? '#475569' : 'var(--primary)', color: 'white',
            cursor: importing ? 'not-allowed' : 'pointer', fontSize: '0.9em',
          }}>
            {importing ? '处理中...' : '📂 选择 CSV 文件'}
            <input type="file" accept=".csv" onChange={handleFileUpload} disabled={importing} style={{ display: 'none' }} />
          </label>
        </div>

        {/* 2. 创建账号 */}
        <div className="glass-panel">
          <h3 style={{ marginTop: 0 }}>2. 创建员工账号</h3>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: 10 }}>
            <input type="text" placeholder="用户名" className="input-field" value={newUsername} onChange={e => setNewUsername(e.target.value)} required />
            <input type="password" placeholder="密码" className="input-field" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            <button type="submit" className="btn" style={{ whiteSpace: 'nowrap' }}>创建</button>
          </form>
        </div>

        {/* 3. 按城市分配 */}
        <div className="glass-panel">
          <h3 style={{ marginTop: 0 }}>3a. 按城市分配</h3>
          <p style={{ fontSize: '0.85em', color: '#94a3b8', margin: '0 0 12px' }}>仅从<strong style={{ color: '#10b981' }}>未分配给任何人</strong>的车商中选取</p>
          <form onSubmit={handleAssignCity} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select className="input-field" value={assignUser} onChange={e => setAssignUser(e.target.value)} required>
              <option value="">-- 选择员工 --</option>
              {staffUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <select className="input-field" value={assignCity} onChange={e => setAssignCity(e.target.value)} required>
              <option value="">-- 选择城市 --</option>
              {cities.map(c => <option key={c} value={c}>{c || '未知城市'}</option>)}
            </select>
            <button type="submit" className="btn btn-success">分配该城市</button>
          </form>
        </div>

        {/* 4. 按条数随机分配 */}
        <div className="glass-panel">
          <h3 style={{ marginTop: 0 }}>3b. 按条数随机分配</h3>
          <p style={{ fontSize: '0.85em', color: '#94a3b8', margin: '0 0 12px' }}>随机从<strong style={{ color: '#10b981' }}>未分配池</strong>中取指定数量（池中剩余：{unassigned} 条）</p>
          <form onSubmit={handleAssignCount} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select className="input-field" value={countUser} onChange={e => setCountUser(e.target.value)} required>
              <option value="">-- 选择员工 --</option>
              {staffUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="number" min="1" max={unassigned || 9999} placeholder="分配条数" className="input-field" value={countNum} onChange={e => setCountNum(e.target.value)} required />
              <select className="input-field" value={countCity} onChange={e => setCountCity(e.target.value)}>
                <option value="">所有城市</option>
                {cities.map(c => <option key={c} value={c}>{c || '未知城市'}</option>)}
              </select>
            </div>
            <button type="submit" className="btn" style={{ background: '#7c3aed' }}>随机分配</button>
          </form>
        </div>

        {/* 5. 员工进度统计 */}
        <div className="glass-panel" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ marginTop: 0 }}>员工开发进度</h3>
          <table>
            <thead>
              <tr>
                <th>员工名称</th>
                <th>已分配</th>
                <th>待联系</th>
                <th>已联系</th>
                <th>有意向</th>
                <th>无意向</th>
                <th>完成率</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>暂无员工数据</td></tr>
              ) : stats.map(s => {
                const done = (s.contacted || 0) + (s.interested || 0) + (s.not_interested || 0);
                const pct = s.total_assigned > 0 ? Math.round(done / s.total_assigned * 100) : 0;
                return (
                  <tr key={s.user_id}>
                    <td style={{ fontWeight: 500 }}>{s.username}</td>
                    <td>{s.total_assigned}</td>
                    <td><span className="status-badge status-pending">{s.pending || 0}</span></td>
                    <td><span className="status-badge status-contacted">{s.contacted || 0}</span></td>
                    <td><span className="status-badge status-interested">{s.interested || 0}</span></td>
                    <td><span className="status-badge status-not_interested">{s.not_interested || 0}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: '0.85em', color: '#94a3b8', whiteSpace: 'nowrap' }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4.5 话术管理 */}
        <div className="glass-panel" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>💬 WhatsApp 话术管理</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85em', color: '#94a3b8' }}>
                员工点击 WhatsApp 按钮时，会从以下话术中<strong style={{ color: '#a78bfa' }}>随机选取一条</strong>预填到对话框（仍需手动发送，可修改）
              </p>
            </div>
            <span style={{ background: '#312e81', color: '#a78bfa', padding: '4px 10px', borderRadius: 20, fontSize: '0.8em' }}>
              共 {templates.length} 条
            </span>
          </div>

          {/* 话术列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {templates.map((t, idx) => (
              <div key={t.id} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '10px 14px',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.85em', minWidth: 24, paddingTop: 2 }}>
                  #{idx + 1}
                </span>
                {editingId === t.id ? (
                  <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                    <textarea
                      value={editingContent}
                      onChange={e => setEditingContent(e.target.value)}
                      className="input-field"
                      rows={3}
                      style={{ flex: 1, resize: 'vertical', fontSize: '0.9em' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8em', background: '#059669' }} onClick={() => handleSaveEdit(t.id)}>保存</button>
                      <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8em', background: '#475569' }} onClick={() => setEditingId(null)}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: '0.9em', color: '#e2e8f0', lineHeight: 1.5 }}>{t.content}</span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn"
                        style={{ padding: '4px 10px', fontSize: '0.78em', background: '#1d4ed8' }}
                        onClick={() => { setEditingId(t.id); setEditingContent(t.content); }}
                      >编辑</button>
                      <button
                        className="btn"
                        style={{ padding: '4px 10px', fontSize: '0.78em', background: '#7f1d1d' }}
                        onClick={() => handleDeleteTemplate(t.id)}
                      >删除</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* 新增话术 */}
          <form onSubmit={handleAddTemplate} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <textarea
              value={newTemplate}
              onChange={e => setNewTemplate(e.target.value)}
              placeholder="输入新话术内容，支持中英文..."
              className="input-field"
              rows={2}
              style={{ flex: 1, resize: 'vertical', fontSize: '0.9em' }}
              required
            />
            <button type="submit" className="btn" style={{ background: '#7c3aed', whiteSpace: 'nowrap', alignSelf: 'stretch' }}>
              + 添加话术
            </button>
          </form>
        </div>

        {/* 6. 数据总览 */}

        <div className="glass-panel" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <h3 style={{ margin: 0 }}>数据总览（显示前 50 条，共 {totalDealers} 条）</h3>
              {selectedIds.length > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  className="btn" 
                  style={{ background: '#b91c1c', padding: '6px 12px', fontSize: '0.85em' }}
                >
                  批量删除 ({selectedIds.length})
                </button>
              )}
            </div>
            <select className="input-field" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">全部状态</option>
              <option value="unassigned">未分配</option>
              <option value="pending">待联系 (Pending)</option>
              <option value="contacted">已联系 (Contacted)</option>
              <option value="interested">有意向 (Interested)</option>
              <option value="not_interested">无意向 (Not Interested)</option>
            </select>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 400 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      checked={dealers.length > 0 && selectedIds.length === Math.min(dealers.length, 50)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedIds(dealers.slice(0, 50).map(d => d.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                  <th>状态</th>
                  <th>分配给</th>
                  <th>车商名称</th>
                  <th>城市</th>
                  <th>电话</th>
                  <th>网站</th>
                  <th>评分</th>
                  <th>评价数</th>
                </tr>
              </thead>
              <tbody>
                {dealers.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>暂无数据</td></tr>
                ) : dealers.slice(0, 50).map(d => (
                  <tr key={d.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox"
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                        checked={selectedIds.includes(d.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, d.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== d.id));
                          }
                        }}
                      />
                    </td>
                    <td>
                      {!d.status ? <span className="status-badge" style={{ background: '#334155', color: '#94a3b8' }}>未分配</span> : 
                       <span className={`status-badge status-${d.status}`}>{d.status}</span>}
                    </td>
                    <td>{d.assigned_to || '-'}</td>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td>{d.city || '-'}</td>
                    <td>{d.phone || '-'}</td>
                    <td>
                      {d.website ? (
                        <a href={d.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>访问网站</a>
                      ) : '-'}
                    </td>
                    <td>{d.rating || '-'}</td>
                    <td>{d.reviews || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
