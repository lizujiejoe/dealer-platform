import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

async function getSession() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;
  const role = cookieStore.get('role')?.value;
  if (!userId) return null;
  return { userId, role };
}

/**
 * PATCH /api/assignments/[id]
 * 员工更新分配记录的状态和备注
 * Body: { status?: string, notes?: string }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    const { id } = await params;
    const { status, notes } = await request.json();

    const validStatuses = ['pending', 'contacted', 'interested', 'not_interested'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: '无效的状态值' }, { status: 400 });
    }

    // 员工只能修改属于自己的分配记录，管理员可修改任意记录
    let query = 'UPDATE assignments SET updated_at = CURRENT_TIMESTAMP';
    const args: any[] = [];

    if (status !== undefined) {
      query += ', status = ?';
      args.push(status);
    }
    if (notes !== undefined) {
      query += ', notes = ?';
      args.push(notes);
    }

    query += ' WHERE id = ?';
    args.push(id);

    if (session.role !== 'admin') {
      query += ' AND user_id = ?';
      args.push(session.userId);
    }

    const result = db.prepare(query).run(...args) as any;

    if (result.changes === 0) {
      return NextResponse.json({ error: '记录不存在或无权限修改' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/assignments/[id] error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

/**
 * DELETE /api/assignments/[id]
 * 仅管理员可取消分配
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const role = cookieStore.get('role')?.value;
  if (role !== 'admin') return NextResponse.json({ error: '权限不足' }, { status: 403 });

  try {
    const { id } = await params;
    const result = db.prepare('DELETE FROM assignments WHERE id = ?').run(id) as any;

    if (result.changes === 0) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
