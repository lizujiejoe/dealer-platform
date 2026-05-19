import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getSession() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;
  const role = cookieStore.get('role')?.value;
  if (!userId) return null;
  return { userId, role };
}

/**
 * GET /api/dealers
 * 管理员: 获取全量车商数据（支持 ?city= 过滤）
 * 员工: 获取分配给自己的车商列表（含跟进状态）
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const statusFilter = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const offset = (page - 1) * pageSize;

    if (session.role === 'admin') {
      // 管理员看全量，关联最新分配状态
      let query = `
        SELECT d.*, 
          (SELECT a.status FROM assignments a WHERE a.dealer_id = d.id ORDER BY a.updated_at DESC LIMIT 1) as status,
          (SELECT u.username FROM assignments a JOIN users u ON a.user_id = u.id WHERE a.dealer_id = d.id ORDER BY a.updated_at DESC LIMIT 1) as assigned_to
        FROM dealers d
        WHERE 1=1
      `;
      const args: any[] = [];
      
      if (city) {
        query += ' AND d.city LIKE ?';
        args.push(`%${city}%`);
      }
      
      if (statusFilter) {
        if (statusFilter === 'unassigned') {
          query += ' AND status IS NULL';
        } else {
          query += ' AND status = ?';
          args.push(statusFilter);
        }
      }

      const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
      const total = (db.prepare(countQuery).get(...args) as any)?.total || 0;

      query += ' ORDER BY d.reviews DESC LIMIT ? OFFSET ?';
      args.push(pageSize, offset);

      console.log('Admin Query:', query);
      console.log('Admin Args:', args);
      const dealers = db.prepare(query).all(...args) as any[];
      console.log('Admin Dealers Length:', dealers.length);

      // 获取所有城市列表
      const cities = db.prepare("SELECT DISTINCT city FROM dealers WHERE city IS NOT NULL AND city != '' ORDER BY city").all() as any[];

      return NextResponse.json({
        dealers,
        total,
        page,
        pageSize,
        cities: cities.map((c: any) => c.city)
      });
    } else {
      // 员工只能看被分配的
      let query = `
        SELECT d.*, a.status, a.notes, a.id as assignment_id, a.updated_at as assignment_updated_at
        FROM assignments a
        JOIN dealers d ON a.dealer_id = d.id
        WHERE a.user_id = ?
      `;
      const args: any[] = [session.userId];

      if (city) {
        query += ' AND d.city LIKE ?';
        args.push(`%${city}%`);
      }

      const countQuery = query.replace(
        'SELECT d.*, a.status, a.notes, a.id as assignment_id, a.updated_at as assignment_updated_at',
        'SELECT COUNT(*) as total'
      );
      const total = (db.prepare(countQuery).get(...args) as any)?.total || 0;

      query += ' ORDER BY d.reviews DESC LIMIT ? OFFSET ?';
      args.push(pageSize, offset);

      const dealers = db.prepare(query).all(...args) as any[];

      const cities = db.prepare(`
        SELECT DISTINCT d.city FROM assignments a
        JOIN dealers d ON a.dealer_id = d.id
        WHERE a.user_id = ? AND d.city IS NOT NULL AND d.city != ''
        ORDER BY d.city
      `).all(session.userId) as any[];

      return NextResponse.json({
        dealers,
        total,
        page,
        pageSize,
        cities: cities.map((c: any) => c.city)
      });
    }
  } catch (error) {
    console.error('GET /api/dealers error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

/**
 * POST /api/dealers
 * 仅管理员，上传并解析 CSV 数据
 * Body: { rows: Array<RawCsvRow> }
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const role = cookieStore.get('role')?.value;
  if (role !== 'admin') return NextResponse.json({ error: '权限不足' }, { status: 403 });

  try {
    const { rows } = await request.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '数据为空' }, { status: 400 });
    }

    // 从地址字段提取城市名（取逗号前的第一段）
    function extractCity(address: string): string {
      if (!address) return '';
      // 格式通常是 "Street Name, City, Country"
      const parts = address.split(',');
      if (parts.length >= 2) {
        return parts[parts.length - 2].trim().replace(' Jia Na', '').trim();
      }
      return parts[0].trim();
    }

    const insert = db.prepare(`
      INSERT INTO dealers
        (place_id, name, description, reviews, rating, website, phone, owner_name, featured_image, main_category, address, city, raw_data)
      VALUES
        (@place_id, @name, @description, @reviews, @rating, @website, @phone, @owner_name, @featured_image, @main_category, @address, @city, @raw_data)
      ON CONFLICT(place_id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        reviews = excluded.reviews,
        rating = excluded.rating,
        website = excluded.website,
        phone = excluded.phone,
        owner_name = excluded.owner_name,
        featured_image = excluded.featured_image,
        main_category = excluded.main_category,
        address = excluded.address,
        city = excluded.city,
        raw_data = excluded.raw_data
    `);

    const insertMany = db.transaction((rows: any[]) => {
      let inserted = 0;
      for (const row of rows) {
        // 规范化 owner_name（去掉末尾的"(Ye Zhu)"）
        const ownerName = row.owner_name?.replace(/\(Ye Zhu\)$/, '').trim() || '';

        insert.run({
          place_id: row.place_id || null,
          name: row.name || '',
          description: row.description || '',
          reviews: parseInt(row.reviews) || 0,
          rating: parseFloat(row.rating) || 0,
          website: row.website || '',
          phone: row.phone || '',
          owner_name: ownerName,
          featured_image: row.featured_image || '',
          main_category: row.main_category || '',
          address: row.address || '',
          city: extractCity(row.address || ''),
          raw_data: JSON.stringify(row),
        });
        inserted++;
      }
      return inserted;
    });

    const count = insertMany(rows);

    return NextResponse.json({ success: true, imported: count }, { status: 201 });
  } catch (error) {
    console.error('POST /api/dealers error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const role = cookieStore.get('role')?.value;
  if (role !== 'admin') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '参数错误，必须提供有效的 IDs 数组' }, { status: 400 });
    }

    const placeholders = ids.map(() => '?').join(',');
    
    const deleteTransaction = db.transaction((dealerIds: number[]) => {
      // 1. 删除关联的 assignments，避免外键约束报错
      db.prepare(`DELETE FROM assignments WHERE dealer_id IN (${placeholders})`).run(...dealerIds);
      
      // 2. 删除 dealers
      const info = db.prepare(`DELETE FROM dealers WHERE id IN (${placeholders})`).run(...dealerIds);
      return info.changes;
    });

    const deletedCount = deleteTransaction(ids);

    return NextResponse.json({ success: true, deleted: deletedCount });
  } catch (error) {
    console.error('DELETE /api/dealers error:', error);
    return NextResponse.json({ error: '删除失败，服务器内部错误' }, { status: 500 });
  }
}

