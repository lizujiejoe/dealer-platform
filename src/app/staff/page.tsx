'use client';

import { useState, useEffect } from 'react';
import NavBar from '@/components/NavBar';
import { Phone, MessageCircle, MapPin, Star } from 'lucide-react';

export default function StaffDashboard() {
  const [dealers, setDealers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [useTemplates, setUseTemplates] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDealers = async () => {
    try {
      const [dealerRes, tmplRes] = await Promise.all([
        fetch('/api/dealers', { cache: 'no-store' }),
        fetch('/api/templates', { cache: 'no-store' }),
      ]);
      const dealerData = await dealerRes.json();
      const tmplData = await tmplRes.json();
      setDealers(dealerData.dealers || []);
      setTemplates(tmplData.templates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealers();
  }, []);

  const updateStatus = async (assignmentId: number, status: string, notes?: string) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes })
      });
      if (res.ok) {
        setDealers(dealers.map(d => d.assignment_id === assignmentId ? { ...d, status, notes: notes !== undefined ? notes : d.notes } : d));
      }
    } catch (e) {
      console.error('Update failed', e);
    }
  };

  const openWhatsApp = (dealer: any) => {
    if (!dealer.phone) return alert('该客户没有电话号码');

    const cleanPhone = dealer.phone.replace(/[^\d+]/g, '').replace('+', '');

    // 随机选取一条话术预填（仍需员工手动点发送，可修改内容）
    let url = `https://wa.me/${cleanPhone}`;
    if (useTemplates && templates.length > 0) {
      const picked = templates[Math.floor(Math.random() * templates.length)];
      url += `?text=${encodeURIComponent(picked.content)}`;
    }
    // 使用固定的窗口名称（如 'whatsapp_web_window'），
    // 这样每次点击都会在同一个标签页中刷新 WhatsApp Web，
    // 而不是打开无数个新标签页，从而完美解决被挤下线或提示“在其他窗口打开”的问题。
    window.open(url, 'whatsapp_web_window');
    // 自动将状态更新为“已联系”
    if (dealer.status === 'pending') {
      updateStatus(dealer.assignment_id, 'contacted');
    }
  };

  if (loading) return <div style={{ padding: 20, color: 'white' }}>加载中...</div>;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px 40px' }}>
      <NavBar title="员工工作台" role="staff" />

      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h2 style={{ margin: 0 }}>我的客户列表 ({dealers.length})</h2>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9em' }}>
            <input 
              type="checkbox" 
              checked={useTemplates}
              onChange={(e) => setUseTemplates(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
            />
            <span style={{ color: useTemplates ? 'var(--primary)' : '#94a3b8' }}>
              随机带入打招呼话术
            </span>
          </label>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>状态</th>
                <th>车商名称</th>
                <th>评分/评价</th>
                <th>联系电话</th>
                <th>网站</th>
                <th>地址</th>
                <th>操作与跟进</th>
              </tr>
            </thead>
            <tbody>
              {dealers.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', opacity: 0.5 }}>暂无分配给您的客户</td></tr>
              ) : dealers.map(d => (
                <tr key={d.id}>
                  <td>
                    <select 
                      className={`status-badge status-${d.status}`} 
                      value={d.status} 
                      onChange={(e) => updateStatus(d.assignment_id, e.target.value)}
                      style={{ border: 'none', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="pending" className="status-pending">待联系</option>
                      <option value="contacted" className="status-contacted">已联系</option>
                      <option value="interested" className="status-interested">有意向</option>
                      <option value="not_interested" className="status-not_interested">无意向</option>
                    </select>
                  </td>
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={14} color="var(--warning)" /> {d.rating} ({d.reviews})
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={14} /> {d.phone || '-'}
                    </div>
                  </td>
                  <td>
                    {d.website ? (
                      <a href={d.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>访问</a>
                    ) : '-'}
                  </td>
                  <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={d.address}>
                      <MapPin size={14} /> {d.city}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={() => openWhatsApp(d)} 
                        className="btn btn-success" 
                        style={{ padding: '6px 12px', fontSize: '0.85em' }}
                        disabled={!d.phone}
                      >
                        <MessageCircle size={14} /> 发送 WhatsApp
                      </button>
                      <input 
                        type="text" 
                        placeholder="添加备注..." 
                        className="input-field" 
                        style={{ width: '150px', padding: '6px', fontSize: '0.85em' }}
                        value={d.notes || ''}
                        onBlur={(e) => updateStatus(d.assignment_id, d.status, e.target.value)}
                        onChange={(e) => setDealers(dealers.map(item => item.assignment_id === d.assignment_id ? { ...item, notes: e.target.value } : item))}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
