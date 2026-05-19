import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;
  const role = cookieStore.get('role')?.value;
  if (!userId || role !== 'admin') return null;
  return { userId, role };
}

/**
 * GET /api/assignments
 * 管理员: 获取所有分配记录（支持 ?user_id= 过滤）
 * 包含车商和用户的概要信息
 */
export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    // 统计每个用户的分配数量和跟进状态
    const stats = db.prepare(`
      SELECT
        u.id as user_id,
        u.username,
        COUNT(a.id) as total_assigned,
        SUM(CASE WHEN a.status = 'contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN a.status = 'interested' THEN 1 ELSE 0 END) as interested,
        SUM(CASE WHEN a.status = 'not_interested' THEN 1 ELSE 0 END) as not_interested,
        SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM users u
      LEFT JOIN assignments a ON u.id = a.user_id
      WHERE u.role = 'staff'
      GROUP BY u.id, u.username
    `).all() as any[];

    let assignmentsQuery = `
      SELECT a.id, a.user_id, a.dealer_id, a.status, a.notes, a.assigned_at, a.updated_at,
             u.username, d.name as dealer_name, d.city, d.phone
      FROM assignments a
      JOIN users u ON a.user_id = u.id
      JOIN dealers d ON a.dealer_id = d.id
    `;

    if (userId) {
      assignmentsQuery += ` WHERE a.user_id = ${parseInt(userId)}`;
    }
    assignmentsQuery += ' ORDER BY a.assigned_at DESC';

    const assignments = db.prepare(assignmentsQuery).all() as any[];

    return NextResponse.json({ stats, assignments });
  } catch (error) {
    console.error('GET /api/assignments error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

/**
 * POST /api/assignments
 * 仅管理员，批量分配车商给用户
 * Body: { user_id: number, dealer_ids: number[] }
 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  try {
    const { user_id, dealer_ids } = await request.json();

    if (!user_id || !Array.isArray(dealer_ids) || dealer_ids.length === 0) {
      return NextResponse.json({ error: '参数错误：需要 user_id 和 dealer_ids 数组' }, { status: 400 });
    }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO assignments (user_id, dealer_id, status)
      VALUES (?, ?, 'pending')
    `);

    const assignMany = db.transaction((dealerIds: number[]) => {
      let count = 0;
      for (const dealerId of dealerIds) {
        const result = insert.run(user_id, dealerId) as any;
        if (result.changes > 0) count++;
      }
      return count;
    });

    const assigned = assignMany(dealer_ids);

    return NextResponse.json({ success: true, assigned }, { status: 201 });
  } catch (error) {
    console.error('POST /api/assignments error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

/**
 * PUT /api/assignments
 * 仅管理员，按城市分配给用户（只从「未分配给任何人」的车商中选取）
 * Body: { user_id: number, city: string }
 */
export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  try {
    const { user_id, city } = await request.json();

    if (!user_id || !city) {
      return NextResponse.json({ error: '参数错误：需要 user_id 和 city' }, { status: 400 });
    }

    // 只获取该城市中「未被任何人分配过」的车商
    const dealers = db.prepare(`
      SELECT id FROM dealers
      WHERE city LIKE ?
        AND id NOT IN (SELECT dealer_id FROM assignments)
    `).all(`%${city}%`) as any[];

    const totalInCity = (db.prepare('SELECT COUNT(*) as c FROM dealers WHERE city LIKE ?').get(`%${city}%`) as any).c;

    if (dealers.length === 0) {
      return NextResponse.json({
        error: `该城市共 ${totalInCity} 个车商，但均已分配给其他同事`
      }, { status: 404 });
    }

    const insert = db.prepare(
      "INSERT OR IGNORE INTO assignments (user_id, dealer_id, status) VALUES (?, ?, 'pending')"
    );
    const assignMany = db.transaction((ids: number[]) => {
      let count = 0;
      for (const id of ids) {
        const result = insert.run(user_id, id) as any;
        if (result.changes > 0) count++;
      }
      return count;
    });

    const assigned = assignMany(dealers.map((d: any) => d.id));

    return NextResponse.json({
      success: true,
      assigned,
      total_in_city: totalInCity,
      skipped_already_assigned: totalInCity - dealers.length
    });
  } catch (error) {
    console.error('PUT /api/assignments error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

/**
 * PATCH /api/assignments
 * 仅管理员，按条数随机分配（只从未分配给任何人的车商中随机选取）
 * Body: { user_id: number, count: number, city?: string }
 */
export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: '权限不足' }, { status: 403 });

  try {
    const { user_id, count, city } = await request.json();

    if (!user_id || !count || count <= 0) {
      return NextResponse.json({ error: '参数错误：需要 user_id 和正整数 count' }, { status: 400 });
    }

    // 查询未分配给任何人的车商，随机指定条数
    let query = `
      SELECT id FROM dealers
      WHERE id NOT IN (SELECT dealer_id FROM assignments)
    `;
    const args: any[] = [];

    if (city) {
      query += ' AND city LIKE ?';
      args.push(`%${city}%`);
    }

    query += ' ORDER BY RANDOM() LIMIT ?';
    args.push(count);

    const toAssign = db.prepare(query).all(...args) as any[];

    // 查询剩余未分配总数
    const remaining = (db.prepare(
      'SELECT COUNT(*) as c FROM dealers WHERE id NOT IN (SELECT dealer_id FROM assignments)'
    ).get() as any).c;

    if (toAssign.length === 0) {
      return NextResponse.json({ error: `没有可分配的未分配车商了（剩余 0 条）` }, { status: 404 });
    }

    const insert = db.prepare(
      "INSERT OR IGNORE INTO assignments (user_id, dealer_id, status) VALUES (?, ?, 'pending')"
    );
    const assignMany = db.transaction((items: any[]) => {
      let assigned = 0;
      for (const d of items) {
        const result = insert.run(user_id, d.id) as any;
        if (result.changes > 0) assigned++;
      }
      return assigned;
    });

    const assigned = assignMany(toAssign);

    const newRemaining = (db.prepare(
      'SELECT COUNT(*) as c FROM dealers WHERE id NOT IN (SELECT dealer_id FROM assignments)'
    ).get() as any).c;

    return NextResponse.json({
      success: true,
      requested: count,
      assigned,
      remaining_before: remaining,
      remaining_after: newRemaining
    });
  } catch (error) {
    console.error('PATCH /api/assignments error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
