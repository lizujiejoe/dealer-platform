'use client';

import { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import NavBar from '@/components/NavBar';
import {
  Upload, UserPlus, Users, MapPin, Shuffle, BarChart2,
  MessageSquare, Database, ChevronLeft, ChevronRight,
  Plus, Pencil, Trash2, Check, X,
} from 'lucide-react';

const ADMIN_PAGE_SIZE = 50;

export default function AdminDashboard() {
  const [stats, setStats]             = useState<any[]>([]);
  const [users, setUsers]             = useState<any[]>([]);
  const [cities, setCities]           = useState<string[]>([]);
  const [dealers, setDealers]         = useState<any[]>([]);
  const [totalDealers, setTotalDealers] = useState(0);
  const [unassigned, setUnassigned]   = useState(0);
  const [loading, setLoading]         = useState(true);
  const [importing, setImporting]     = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // 员工创建
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // 按城市分配
  const [assignUser, setAssignUser] = useState('');
  const [assignCity, setAssignCity] = useState('');

  // 按条数随机分配
  const [countUser, setCountUser] = useState('');
  const [countNum,  setCountNum]  = useState('');
  const [countCity, setCountCity] = useState('');

  // 数据总览过滤 & 分页
  const [filterStatus,   setFilterStatus]   = useState('');
  const [adminPage,      setAdminPage]       = useState(1);
  const [adminTotal,     setAdminTotal]      = useState(0);
  const [selectedIds,    setSelectedIds]     = useState<number[]>([]);

  // 话术管理
  const [templates,      setTemplates]      = useState<any[]>([]);
  const [newTemplate,    setNewTemplate]    = useState('');
  const [editingId,      setEditingId]      = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const adminTotalPages = Math.max(1, Math.ceil(adminTotal / ADMIN_PAGE_SIZE));

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── 拉数据 ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async (page = adminPage) => {
    try {
      const params = new URLSearchParams({
        page:     String(page),
        pageSize: String(ADMIN_PAGE_SIZE),
        ...(filterStatus ? { status: filterStatus } : {}),
      });

      const [usersRes, assignRes, dealersRes, tmplRes] = await Promise.all([
        fetch('/api/users', { cache: 'no-store' }),
        fetch('/api/assignments', { cache: 'no-store' }),
        fetch(`/api/dealers?${params}`, { cache: 'no-store' }),
        fetch('/api/templates', { cache: 'no-store' }),
      ]);
      const usersData   = await usersRes.json();
      const assignData  = await assignRes.json();
      const dealersData = await dealersRes.json();
      const tmplData    = await tmplRes.json();

      setUsers(usersData.users || []);
      setStats(assignData.stats || []);
      setCities(dealersData.cities || []);
      setDealers(dealersData.dealers || []);
      setAdminTotal(dealersData.total || 0);
      setTotalDealers(dealersData.total || 0);
      setSelectedIds([]);
      setTemplates(tmplData.templates || []);

      // 未分配数量
      const uniqueAssigned = new Set((assignData.assignments || []).map((a: any) => a.dealer_id));
      setUnassigned(dealersData.total - uniqueAssigned.size < 0 ? 0 : dealersData.total - uniqueAssigned.size);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [adminPage, filterStatus]);

  useEffect(() => { setAdminPage(1); }, [filterStatus]);
  useEffect(() => { fetchData(adminPage); }, [adminPage, filterStatus]); // eslint-disable-line

  // ── 操作处理器 ───────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res  = await fetch('/api/dealers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: results.data }),
            cache: 'no-store',
          });
          const data = await res.json();
          if (res.ok) {
            showToast(`✅ 成功导入 ${data.imported} 条车商数据！`);
            fetchData(1);
          } else {
            showToast('导入失败: ' + data.error, 'err');
          }
        } catch {
          showToast('导入异常，请重试', 'err');
        } finally {
          setImporting(false);
          e.target.value = '';
        }
      },
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
      fetchData(adminPage);
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
      fetchData(adminPage);
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
      fetchData(adminPage);
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
      fetchData(adminPage);
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
      fetchData(adminPage);
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
      fetchData(adminPage);
    } else {
      showToast('更新失败', 'err');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`警告：确定要彻底删除选中的 ${selectedIds.length} 条车商数据吗？\n该操作不可恢复，且会同步删除关联的员工跟进记录！`)) return;
    try {
      const res = await fetch('/api/dealers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✅ 成功删除 ${data.deleted} 条数据`);
        fetchData(1);
      } else {
        showToast(`删除失败: ${data.error}`, 'err');
      }
    } catch {
      showToast('删除异常', 'err');
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '0 20px 40px' }}>
        <div style={{ height: 60, marginBottom: 20 }} className="shimmer" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
        <div className="shimmer" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  const staffUsers = users.filter(u => u.role === 'staff');

  // 进度条颜色
  const pctColor = (pct: number) =>
    pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--primary)' : 'var(--warning)';

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '0 20px 60px' }}>
      <NavBar title="管理后台" role="admin" />

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'ok' ? 'toast-ok' : 'toast-err'}`}>
          {toast.msg}
        </div>
      )}

      {/* 概览卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '数据库车商总数', value: totalDealers, color: 'var(--primary)' },
          { label: '未分配给任何人', value: unassigned,   color: 'var(--success)' },
          { label: '员工账号数',     value: staffUsers.length, color: 'var(--warning)' },
        ].map(card => (
          <div key={card.label} className="glass-panel stat-card" style={{ '--accent-color': card.color } as any}>
            <div className="stat-number">{card.value}</div>
            <div className="stat-label">{card.label}</div>
          </div>
        ))}
      </div>

      {/* 操作区 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* 1. CSV 导入 */}
        <div className="glass-panel">
          <div className="section-header" style={{ marginBottom: 12 }}>
            <h3 className="section-title"><Upload size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />导入数据 (CSV)</h3>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
            支持多次上传，相同 place_id 自动覆盖更新。无电话号码的记录将被过滤。
          </p>
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 'var(--radius)',
            background: importing ? 'rgba(255,255,255,0.05)' : 'var(--primary-dim)',
            color: importing ? 'var(--text-3)' : 'var(--primary)',
            border: `1px solid ${importing ? 'var(--border)' : 'rgba(79,141,255,0.3)'}`,
            cursor: importing ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: '0.875rem', transition: 'all var(--transition)',
          }}>
            <Upload size={14} />
            {importing ? '处理中...' : '选择 CSV 文件'}
            <input type="file" accept=".csv" onChange={handleFileUpload} disabled={importing} style={{ display: 'none' }} />
          </label>
        </div>

        {/* 2. 创建账号 */}
        <div className="glass-panel">
          <div className="section-header" style={{ marginBottom: 12 }}>
            <h3 className="section-title"><UserPlus size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />创建员工账号</h3>
          </div>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text" placeholder="用户名" className="input-field"
              value={newUsername} onChange={e => setNewUsername(e.target.value)} required
            />
            <input
              type="password" placeholder="密码" className="input-field"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} required
            />
            <button type="submit" className="btn btn-solid" style={{ alignSelf: 'flex-start' }}>
              <UserPlus size={14} /> 创建账号
            </button>
          </form>
        </div>

        {/* 3. 按城市分配 */}
        <div className="glass-panel">
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h3 className="section-title"><MapPin size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />按城市分配</h3>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
            仅从<strong style={{ color: 'var(--success)' }}>未分配给任何人</strong>的车商中选取
          </p>
          <form onSubmit={handleAssignCity} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select className="input-field" value={assignUser} onChange={e => setAssignUser(e.target.value)} required>
              <option value="">— 选择员工 —</option>
              {staffUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <select className="input-field" value={assignCity} onChange={e => setAssignCity(e.target.value)} required>
              <option value="">— 选择城市 —</option>
              {cities.map(c => <option key={c} value={c}>{c || '未知城市'}</option>)}
            </select>
            <button type="submit" className="btn btn-success" style={{ alignSelf: 'flex-start' }}>
              <MapPin size={14} /> 分配该城市
            </button>
          </form>
        </div>

        {/* 4. 按条数随机分配 */}
        <div className="glass-panel">
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h3 className="section-title"><Shuffle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />随机分配</h3>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
            从<strong style={{ color: 'var(--success)' }}>未分配池</strong>中随机选取（池中剩余：<strong style={{ color: 'var(--text)' }}>{unassigned}</strong> 条）
          </p>
          <form onSubmit={handleAssignCount} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select className="input-field" value={countUser} onChange={e => setCountUser(e.target.value)} required>
              <option value="">— 选择员工 —</option>
              {staffUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="number" min="1" placeholder="分配条数" className="input-field"
                value={countNum} onChange={e => setCountNum(e.target.value)} required
              />
              <select className="input-field" value={countCity} onChange={e => setCountCity(e.target.value)}>
                <option value="">所有城市</option>
                {cities.map(c => <option key={c} value={c}>{c || '未知城市'}</option>)}
              </select>
            </div>
            <button type="submit" className="btn" style={{ alignSelf: 'flex-start', background: 'var(--purple-dim)', color: 'var(--purple)', borderColor: 'rgba(167,139,250,0.3)' }}>
              <Shuffle size={14} /> 随机分配
            </button>
          </form>
        </div>
      </div>

      {/* 5. 员工进度统计 */}
      <div className="glass-panel" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <h3 className="section-title"><BarChart2 size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />员工开发进度</h3>
          <span className="text-muted text-sm">{staffUsers.length} 名员工</span>
        </div>
        {stats.length === 0 ? (
          <div className="empty-state"><div className="empty-state-text">暂无员工数据</div></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>员工</th>
                  <th>已分配</th>
                  <th>待联系</th>
                  <th>已联系</th>
                  <th>有意向</th>
                  <th>无意向</th>
                  <th style={{ minWidth: 180 }}>完成率</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(s => {
                  const done = (s.contacted || 0) + (s.interested || 0) + (s.not_interested || 0);
                  const pct  = s.total_assigned > 0 ? Math.round(done / s.total_assigned * 100) : 0;
                  return (
                    <tr key={s.user_id}>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{s.username}</td>
                      <td>{s.total_assigned}</td>
                      <td><span className="status-badge status-pending">{s.pending || 0}</span></td>
                      <td><span className="status-badge status-contacted">{s.contacted || 0}</span></td>
                      <td><span className="status-badge status-interested">{s.interested || 0}</span></td>
                      <td><span className="status-badge status-not_interested">{s.not_interested || 0}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${pct}%`, background: pctColor(pct) }} />
                          </div>
                          <span className="text-sm" style={{ color: pctColor(pct), fontWeight: 700, minWidth: 38 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. 话术管理 */}
      <div className="glass-panel" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <div>
            <h3 className="section-title" style={{ marginBottom: 4 }}>
              <MessageSquare size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              WhatsApp 话术管理
            </h3>
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              员工可在其他渠道引用话术，管理员在此维护话术库
            </p>
          </div>
          <span style={{ background: 'var(--purple-dim)', color: 'var(--purple)', padding: '4px 12px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, border: '1px solid rgba(167,139,250,0.2)' }}>
            共 {templates.length} 条
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {templates.map((t, idx) => (
            <div key={t.id} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '12px 14px',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{ color: 'var(--purple)', fontWeight: 700, fontSize: '0.78rem', minWidth: 22, paddingTop: 2 }}>#{idx+1}</span>
              {editingId === t.id ? (
                <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                  <textarea
                    value={editingContent}
                    onChange={e => setEditingContent(e.target.value)}
                    className="input-field"
                    rows={3}
                    style={{ flex: 1, fontSize: '0.875rem' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleSaveEdit(t.id)}>
                      <Check size={13} />
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setEditingId(null)}>
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{t.content}</span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => { setEditingId(t.id); setEditingContent(t.content); }}>
                      <Pencil size={12} />
                    </button>
                    <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => handleDeleteTemplate(t.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleAddTemplate} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <textarea
            value={newTemplate}
            onChange={e => setNewTemplate(e.target.value)}
            placeholder="输入新话术内容..."
            className="input-field"
            rows={2}
            style={{ flex: 1, fontSize: '0.875rem' }}
            required
          />
          <button type="submit" className="btn" style={{ background: 'var(--purple-dim)', color: 'var(--purple)', borderColor: 'rgba(167,139,250,0.3)', alignSelf: 'stretch', whiteSpace: 'nowrap' }}>
            <Plus size={14} /> 添加话术
          </button>
        </form>
      </div>

      {/* 7. 数据总览 + 真实分页 */}
      <div className="glass-panel">
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 className="section-title">
              <Database size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              数据总览
            </h3>
            <span className="text-muted text-sm">
              共 <strong style={{ color: 'var(--text)' }}>{adminTotal}</strong> 条
            </span>
            {selectedIds.length > 0 && (
              <button onClick={handleBulkDelete} className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '0.82rem' }}>
                <Trash2 size={13} /> 批量删除 ({selectedIds.length})
              </button>
            )}
          </div>
          <select
            className="input-field"
            style={{ width: 'auto' }}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="unassigned">未分配</option>
            <option value="pending">待联系</option>
            <option value="contacted">已联系</option>
            <option value="interested">有意向</option>
            <option value="not_interested">无意向</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: 480 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                    checked={dealers.length > 0 && selectedIds.length === dealers.length}
                    onChange={e => setSelectedIds(e.target.checked ? dealers.map(d => d.id) : [])}
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
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🔍</div>
                      <div className="empty-state-text">暂无数据</div>
                    </div>
                  </td>
                </tr>
              ) : dealers.map(d => (
                <tr key={d.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      checked={selectedIds.includes(d.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(prev => [...prev, d.id]);
                        else setSelectedIds(prev => prev.filter(id => id !== d.id));
                      }}
                    />
                  </td>
                  <td>
                    {!d.status
                      ? <span className="status-badge status-unassigned">未分配</span>
                      : <span className={`status-badge status-${d.status}`}>{d.status}</span>
                    }
                  </td>
                  <td className="text-sm">{d.assigned_to || <span className="text-muted">—</span>}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text)', maxWidth: 200 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.name}>{d.name}</div>
                  </td>
                  <td className="text-sm">{d.city || <span className="text-muted">—</span>}</td>
                  <td className="text-sm">{d.phone || <span className="text-muted">—</span>}</td>
                  <td>
                    {d.website
                      ? <a href={d.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 500 }}>访问</a>
                      : <span className="text-muted text-sm">—</span>
                    }
                  </td>
                  <td className="text-sm">{d.rating || '—'}</td>
                  <td className="text-sm">{d.reviews || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 真实分页 */}
        {adminTotal > ADMIN_PAGE_SIZE && (
          <div className="pagination">
            <button className="page-btn" onClick={() => setAdminPage(1)} disabled={adminPage === 1} title="第一页">«</button>
            <button className="page-btn" onClick={() => setAdminPage(p => Math.max(1, p - 1))} disabled={adminPage === 1}>
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: adminTotalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === adminTotalPages || Math.abs(p - adminPage) <= 2)
              .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'ellipsis'
                  ? <span key={`e${idx}`} className="page-info">…</span>
                  : <button
                      key={item}
                      className={`page-btn${adminPage === item ? ' active' : ''}`}
                      onClick={() => setAdminPage(item as number)}
                    >{item}</button>
              )
            }

            <button className="page-btn" onClick={() => setAdminPage(p => Math.min(adminTotalPages, p + 1))} disabled={adminPage === adminTotalPages}>
              <ChevronRight size={14} />
            </button>
            <button className="page-btn" onClick={() => setAdminPage(adminTotalPages)} disabled={adminPage === adminTotalPages} title="最后一页">»</button>
            <span className="page-info">{adminPage} / {adminTotalPages} 页 · 每页 {ADMIN_PAGE_SIZE} 条</span>
          </div>
        )}
      </div>
    </div>
  );
}
