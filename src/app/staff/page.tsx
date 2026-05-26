'use client';

import { useState, useEffect, useCallback } from 'react';
import NavBar from '@/components/NavBar';
import { Phone, Copy, Check, MapPin, Star, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:      { label: '待联系', cls: 'status-pending' },
  contacted:    { label: '已联系', cls: 'status-contacted' },
  interested:   { label: '有意向', cls: 'status-interested' },
  not_interested: { label: '无意向', cls: 'status-not_interested' },
};

const PAGE_SIZE = 30;

export default function StaffDashboard() {
  const [dealers, setDealers]         = useState<any[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);

  // 过滤 & 排序
  const [statusFilter, setStatusFilter] = useState('');        // '' = 全部
  const [sort, setSort]                 = useState('updated_at_desc');
  const [search, setSearch]             = useState('');

  // 复制状态: record assignment_id → boolean
  const [copiedMap, setCopiedMap] = useState<Record<number, boolean>>({});

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchDealers = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:     String(p),
        pageSize: String(PAGE_SIZE),
        sort,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res  = await fetch(`/api/dealers?${params}`, { cache: 'no-store' });
      const data = await res.json();
      setDealers(data.dealers || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, sort, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sort]);

  useEffect(() => {
    fetchDealers(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, statusFilter]);

  // 前端搜索过滤（在已加载分页数据中搜索）
  const visibleDealers = search.trim()
    ? dealers.filter(d =>
        d.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.phone?.includes(search)
      )
    : dealers;

  const updateStatus = async (assignmentId: number, status: string, notes?: string) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      if (res.ok) {
        setDealers(prev => prev.map(d =>
          d.assignment_id === assignmentId
            ? { ...d, status, ...(notes !== undefined ? { notes } : {}) }
            : d
        ));
      }
    } catch (e) {
      console.error('Update failed', e);
    }
  };

  /** 兼容所有环境的剪贴板复制：优先用 Clipboard API，降级用 execCommand */
  const copyToClipboard = async (text: string): Promise<boolean> => {
    // 方法一：Clipboard API（需要 HTTPS 或 localhost）
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // 权限被拒绝等情况，继续降级
      }
    }
    // 方法二：execCommand 降级（兼容 HTTP、旧版浏览器、安卓 WebView 等）
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      // 不影响页面布局，不触发滚动
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopyPhone = async (dealer: any) => {
    if (!dealer.phone) { showToast('该客户没有电话号码', 'err'); return; }

    const cleanPhone = dealer.phone.replace(/[^\d+]/g, '');
    const success = await copyToClipboard(cleanPhone);

    if (success) {
      // 标记复制成功
      setCopiedMap(prev => ({ ...prev, [dealer.assignment_id]: true }));
      setTimeout(() => setCopiedMap(prev => ({ ...prev, [dealer.assignment_id]: false })), 1800);
      showToast(`已复制 ${cleanPhone}`);
      // 若仍是「待联系」，自动更新为「已联系」
      if (dealer.status === 'pending') {
        updateStatus(dealer.assignment_id, 'contacted');
      }
    } else {
      showToast('复制失败，请手动长按号码复制', 'err');
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const toggleSort = () => {
    setSort(s => s === 'updated_at_desc' ? 'updated_at_asc' : 'updated_at_desc');
  };

  // 进度计数（仅基于当前分页本不准，展示用）
  const statusCounts = dealers.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px 60px' }}>
      <NavBar title="员工工作台" role="staff" />

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'ok' ? 'toast-ok' : 'toast-err'}`}>
          {toast.msg}
        </div>
      )}

      {/* 概览条 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '共分配', value: total, color: 'var(--primary)' },
          { label: '待联系', value: statusCounts['pending'] || 0, color: 'var(--warning)' },
          { label: '已联系', value: statusCounts['contacted'] || 0, color: 'var(--primary)' },
          { label: '有意向', value: statusCounts['interested'] || 0, color: 'var(--success)' },
        ].map(c => (
          <div key={c.label} className="glass-panel stat-card" style={{ '--accent-color': c.color } as any}>
            <div className="stat-number">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* 主内容区 */}
      <div className="glass-panel">
        {/* 工具栏 */}
        <div className="section-header">
          <div className="filter-bar">
            {/* 搜索 */}
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}
              />
              <input
                type="text"
                className="input-field"
                placeholder="搜索客户名称或电话..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 32, width: 220 }}
              />
            </div>

            {/* 状态过滤 */}
            <select
              className="input-field"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ width: 140 }}
            >
              <option value="">全部状态</option>
              <option value="pending">待联系</option>
              <option value="contacted">已联系</option>
              <option value="interested">有意向</option>
              <option value="not_interested">无意向</option>
            </select>

            {/* 排序切换 */}
            <button className="btn btn-ghost" onClick={toggleSort} title="切换排序方式">
              {sort === 'updated_at_desc'
                ? <><ArrowDown size={14} />最新更新</>
                : <><ArrowUp size={14} />最早更新</>
              }
            </button>
          </div>

          <span className="text-muted text-sm">
            共 <strong style={{ color: 'var(--text)' }}>{total}</strong> 条
            {statusFilter && <> · 已过滤</>}
          </span>
        </div>

        {/* 表格 */}
        {loading ? (
          <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="shimmer" style={{ height: 52, borderRadius: 'var(--radius)' }} />
            ))}
          </div>
        ) : visibleDealers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">
              {statusFilter ? `当前筛选条件下没有任务` : '暂无分配给您的客户'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>状态</th>
                  <th>车商名称</th>
                  <th>联系电话</th>
                  <th>评分 / 评价数</th>
                  <th>城市</th>
                  <th>网站</th>
                  <th>备注</th>
                  <th style={{ textAlign: 'center' }}>
                    <span
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      onClick={toggleSort}
                      title="点击切换排序"
                    >
                      更新时间
                      {sort === 'updated_at_desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleDealers.map(d => (
                  <tr key={d.id}>
                    {/* 状态 */}
                    <td>
                      <select
                        className={`status-badge status-${d.status}`}
                        value={d.status}
                        onChange={e => updateStatus(d.assignment_id, e.target.value)}
                        style={{ border: 'none', outline: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', fontWeight: 600 }}
                      >
                        <option value="pending">待联系</option>
                        <option value="contacted">已联系</option>
                        <option value="interested">有意向</option>
                        <option value="not_interested">无意向</option>
                      </select>
                    </td>

                    {/* 名称 */}
                    <td style={{ fontWeight: 600, color: 'var(--text)', maxWidth: 200 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.name}>
                        {d.name}
                      </div>
                    </td>

                    {/* 电话 — 点击复制 */}
                    <td>
                      {d.phone ? (
                        <button
                          className={`phone-copy-btn ${copiedMap[d.assignment_id] ? 'copied' : ''}`}
                          onClick={() => handleCopyPhone(d)}
                          title="点击复制号码，并自动标记为已联系"
                        >
                          {copiedMap[d.assignment_id]
                            ? <><Check size={13} /> 已复制</>
                            : <><Copy size={13} /> {d.phone}</>
                          }
                        </button>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </td>

                    {/* 评分 */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Star size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{d.rating || '—'}</span>
                        <span className="text-muted text-sm">({d.reviews || 0})</span>
                      </div>
                    </td>

                    {/* 城市 */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                        <span>{d.city || '—'}</span>
                      </div>
                    </td>

                    {/* 网站 */}
                    <td>
                      {d.website ? (
                        <a
                          href={d.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 500 }}
                        >
                          访问
                        </a>
                      ) : <span className="text-muted text-sm">—</span>}
                    </td>

                    {/* 备注 */}
                    <td>
                      <input
                        type="text"
                        className="notes-input"
                        placeholder="添加备注..."
                        value={d.notes || ''}
                        onBlur={e => updateStatus(d.assignment_id, d.status, e.target.value)}
                        onChange={e => setDealers(prev => prev.map(item =>
                          item.assignment_id === d.assignment_id ? { ...item, notes: e.target.value } : item
                        ))}
                      />
                    </td>

                    {/* 更新时间 */}
                    <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {d.assignment_updated_at
                        ? new Date(d.assignment_updated_at + (d.assignment_updated_at.includes('T') ? '' : 'Z'))
                            .toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页 */}
        {!loading && total > PAGE_SIZE && (
          <div className="pagination">
            <button className="page-btn" onClick={() => handlePageChange(1)} disabled={page === 1} title="第一页">«</button>
            <button className="page-btn" onClick={() => handlePageChange(page - 1)} disabled={page === 1}>
              <ChevronLeft size={14} />
            </button>

            {/* 页码：显示当前页附近 */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
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
                      className={`page-btn${page === item ? ' active' : ''}`}
                      onClick={() => handlePageChange(item as number)}
                    >{item}</button>
              )
            }

            <button className="page-btn" onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}>
              <ChevronRight size={14} />
            </button>
            <button className="page-btn" onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} title="最后一页">»</button>
            <span className="page-info">{page} / {totalPages} 页</span>
          </div>
        )}
      </div>
    </div>
  );
}
