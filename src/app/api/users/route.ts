import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// 鉴权中间件
async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;
  const role = cookieStore.get('role')?.value;
  if (!userId || role !== 'admin') return null;
  return { userId, role };
}

// GET /api/users - 获取所有用户（仅管理员）
export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  try {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id ASC').all() as any[];
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// POST /api/users - 新建用户（仅管理员）
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  try {
    const { username, password, role = 'staff' } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    const stmt = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    const result = stmt.run(username, password, role) as any;

    return NextResponse.json({
      user: { id: result.lastInsertRowid, username, role }
    }, { status: 201 });
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
    }
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
