import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.sqlite');

const db: Database.Database = new Database(dbPath);

db.pragma('journal_mode = WAL');

// ─── 建表 SQL（不含任何字符串字面量，避免转义问题）───────────────
const initSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dealers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      reviews INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      website TEXT,
      phone TEXT,
      owner_name TEXT,
      featured_image TEXT,
      main_category TEXT,
      address TEXT,
      city TEXT,
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      dealer_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(dealer_id) REFERENCES dealers(id),
      UNIQUE(user_id, dealer_id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`;

// 执行建表
db.exec(initSql);

// ─── 用 JS 安全地插入默认数据（完全避开 SQL 字符串转义问题）────────

// 默认管理员
db.prepare(
  "INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)"
).run('admin', 'admin123', 'admin');

// 预置话术（仅在话术表为空时插入）
const templateCount = (db.prepare('SELECT COUNT(*) as c FROM templates').get() as any).c;
if (templateCount === 0) {
  const insertTpl = db.prepare('INSERT INTO templates (content) VALUES (?)');
  const seedTemplates = db.transaction(() => {
    insertTpl.run("Hi, I came across your dealership on Google Maps and I'm interested in discussing a potential business opportunity. We specialize in quality used vehicles from Japan and South Korea. Would you be open to a quick chat?");
    insertTpl.run("Hello! I found your car dealership on Google Maps. We deal in quality pre-owned vehicles and I think there could be a great partnership opportunity. Can we connect?");
    insertTpl.run("Good day! I noticed your auto dealership on Google Maps and wanted to reach out. We supply quality used cars at competitive prices and believe we could help expand your inventory. Interested in learning more?");
    insertTpl.run("Hi there! Saw your dealership on Google Maps - great reviews! I work with quality used vehicle exports and think we would be a great fit. Mind if I share a few details about what we offer?");
    insertTpl.run("Hello! Your dealership caught my attention on Google Maps. We export quality pre-owned vehicles and are always looking for trusted local partners. Would you have a moment to discuss a potential collaboration?");
  });
  seedTemplates();
}

export default db;
