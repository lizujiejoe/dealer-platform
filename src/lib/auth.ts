import { cookies } from 'next/headers';
import db from './db';

export async function getSession() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;

  if (!userId) return null;

  try {
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId) as any;
    if (user) {
      return user;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function setSession(userId: string | number, role: string) {
  const cookieStore = await cookies();
  cookieStore.set('userId', String(userId), { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7 });
  cookieStore.set('role', role, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('userId');
  cookieStore.delete('role');
}
