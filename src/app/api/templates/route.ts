import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const role = cookieStore.get('role')?.value;
  if (role !== 'admin') return null;
  return { role };
}

// GET /api/templates — 所有登录用户可访问（员工需要拉取话术）
export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const templates = db.prepare('SELECT * FROM templates ORDER BY id ASC').all();
  return NextResponse.json({ templates });
}

// POST /api/templates — 仅管理员，新增话术
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  const { content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: '话术内容不能为空' }, { status: 400 });

  const result = db.prepare('INSERT INTO templates (content) VALUES (?)').run(content.trim()) as any;
  return NextResponse.json({ success: true, id: result.lastInsertRowid }, { status: 201 });
}

// DELETE /api/templates — 仅管理员，删除话术
export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const count = (db.prepare('SELECT COUNT(*) as c FROM templates').get() as any).c;
  if (count <= 1) return NextResponse.json({ error: '至少需要保留一条话术' }, { status: 400 });

  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}

// PUT /api/templates — 仅管理员，编辑话术内容
export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  const { id, content } = await request.json();
  if (!id || !content?.trim()) return NextResponse.json({ error: '参数错误' }, { status: 400 });

  db.prepare('UPDATE templates SET content = ? WHERE id = ?').run(content.trim(), id);
  return NextResponse.json({ success: true });
}
