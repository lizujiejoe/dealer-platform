import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('userId');
    cookieStore.delete('role');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
