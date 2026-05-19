import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;
  const role = cookieStore.get('role')?.value;
  if (!userId || role !== 'admin') return null;
  return { userId, role };
}

// PATCH /api/users/[id] - 修改用户密码（仅管理员）
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  try {
    const { id } = await params;
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    const result = db.prepare('UPDATE users SET password = ? WHERE id = ?').run(password, id) as any;

    if (result.changes === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - 删除用户（仅管理员）
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  try {
    const { id } = await params;

    if (id === '1') {
      return NextResponse.json({ error: '不能删除系统默认管理员' }, { status: 400 });
    }

    // 同步删除该用户的所有分配记录
    db.prepare('DELETE FROM assignments WHERE user_id = ?').run(id);
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id) as any;

    if (result.changes === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
