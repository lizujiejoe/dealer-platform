import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    const user = db.prepare('SELECT id, username, role FROM users WHERE username = ? AND password = ?').get(username, password) as any;

    if (!user) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set('userId', String(user.id), { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7 });
    cookieStore.set('role', user.role, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7 });

    return NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
