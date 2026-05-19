import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('userId')?.value;

    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId) as any;

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
