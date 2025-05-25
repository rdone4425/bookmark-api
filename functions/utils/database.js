// 数据库管理工具类
export class DatabaseManager {
    constructor(db) {
        if (!db) {
            throw new Error('DB is not defined. Please ensure D1 database is properly bound in Cloudflare Pages settings.');
        }
        this.db = db;
    }

    // 初始化数据库表
    async initializeTables() {
        try {
            await this.createBookmarksTable();
            await this.createAuthTable();
            await this.createLoginLogsTable();
            console.log('数据库表初始化完成');
        } catch (error) {
            console.error('数据库表初始化失败:', error);
            throw error;
        }
    }

    // 创建书签表
    async createBookmarksTable() {
        const createTableSQL = `CREATE TABLE IF NOT EXISTS bookmarks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            url TEXT NOT NULL,
            category TEXT DEFAULT '',
            subcategory TEXT DEFAULT '',
            icon TEXT DEFAULT '',
            path TEXT DEFAULT '',
            date_added INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        await this.db.prepare(createTableSQL).run();

        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url)',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title)',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category)'
        ];

        for (const indexSQL of indexes) {
            await this.db.prepare(indexSQL).run();
        }
    }

    // 创建认证表
    async createAuthTable() {
        const createTableSQL = `CREATE TABLE IF NOT EXISTS auth (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        await this.db.prepare(createTableSQL).run();

        const checkAdmin = await this.queryFirst('SELECT COUNT(*) as count FROM auth WHERE username = ?', ['admin']);

        if (!checkAdmin || checkAdmin.count === 0) {
            await this.insert(
                'INSERT INTO auth (username, password) VALUES (?, ?)',
                ['admin', 'admin123']
            );
            console.log('已创建默认管理员账户: admin/admin123');
        }
    }

    // 创建登录日志表
    async createLoginLogsTable() {
        const createTableSQL = `CREATE TABLE IF NOT EXISTS login_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (user_id) REFERENCES auth (id)
        )`;

        await this.db.prepare(createTableSQL).run();

        // 创建索引
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_login_logs_login_time ON login_logs(login_time)'
        ];

        for (const indexSQL of indexes) {
            await this.db.prepare(indexSQL).run();
        }
    }

    // 执行查询
    async query(sql, params = []) {
        try {
            console.log('执行SQL:', sql, '参数:', params);

            let result;
            if (params.length > 0) {
                const stmt = this.db.prepare(sql);
                result = await stmt.bind(...params).all();
            } else {
                // 对于没有参数的查询，也使用prepare方式
                const stmt = this.db.prepare(sql);
                result = await stmt.all();
            }

            // 确保返回格式一致
            if (result && result.results) {
                return result; // 已经是正确格式
            } else if (Array.isArray(result)) {
                return { results: result }; // 包装成正确格式
            } else {
                console.log('意外的查询结果格式:', result);
                return { results: [] };
            }
        } catch (error) {
            console.error('数据库查询失败:', error);
            throw error;
        }
    }

    // 执行单个查询并返回第一行
    async queryFirst(sql, params = []) {
        try {
            console.log('执行单行查询SQL:', sql, '参数:', params);

            let result;
            if (params.length > 0) {
                const stmt = this.db.prepare(sql);
                result = await stmt.bind(...params).first();
            } else {
                const stmt = this.db.prepare(sql);
                result = await stmt.first();
            }

            return result || null;
        } catch (error) {
            console.error('数据库单行查询失败:', error);
            return null;
        }
    }

    // 插入数据并返回插入的ID
    async insert(sql, params = []) {
        try {
            console.log('执行插入SQL:', sql, '参数:', params);
            const stmt = this.db.prepare(sql);
            return await stmt.bind(...params).run();
        } catch (error) {
            console.error('数据库插入失败:', error);
            throw error;
        }
    }



    // 检查书签是否存在
    async bookmarkExists(url) {
        const result = await this.queryFirst('SELECT id FROM bookmarks WHERE url = ?', [url]);
        return !!result;
    }

    // 根据URL获取书签
    async getBookmarkByUrl(url) {
        return await this.queryFirst('SELECT * FROM bookmarks WHERE url = ?', [url]);
    }

    // 根据ID获取书签
    async getBookmarkById(id) {
        return await this.queryFirst('SELECT * FROM bookmarks WHERE id = ?', [id]);
    }

    // 获取书签统计信息
    async getBookmarkStats() {
        const totalResult = await this.queryFirst('SELECT COUNT(*) as total FROM bookmarks');
        const categoryResult = await this.query(`
            SELECT category, COUNT(*) as count
            FROM bookmarks
            WHERE category != ''
            GROUP BY category
            ORDER BY count DESC
        `);

        const recentResult = await this.queryFirst(`
            SELECT COUNT(*) as count
            FROM bookmarks
            WHERE created_at >= datetime('now', '-1 day')
        `);

        return {
            total: totalResult?.total || 0,
            categories: categoryResult || [],
            recentCount: recentResult?.count || 0
        };
    }

    // 获取登录日志
    async getLoginLogs(limit = 10) {
        return await this.query(`
            SELECT * FROM login_logs
            ORDER BY login_time DESC
            LIMIT ?
        `, [limit]);
    }

    // 获取数据库表信息
    async getTableInfo() {
        try {
            const tables = await this.query(`
                SELECT name FROM sqlite_master
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `);

            const tableInfo = {};

            for (const table of tables) {
                const tableName = table.name;

                // 获取表结构
                const schema = await this.query(`PRAGMA table_info(${tableName})`);

                // 获取记录数
                const count = await this.queryFirst(`SELECT COUNT(*) as count FROM ${tableName}`);

                tableInfo[tableName] = {
                    columns: schema,
                    count: count?.count || 0
                };
            }

            return tableInfo;
        } catch (error) {
            console.error('获取表信息失败:', error);
            throw error;
        }
    }

    // 清理旧的登录日志（保留最近30天）
    async cleanupOldLogs() {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM login_logs
                WHERE login_time < datetime('now', '-30 days')
            `);
            const result = await stmt.run();
            console.log(`清理了 ${result.changes} 条旧的登录日志`);
            return result.changes;
        } catch (error) {
            console.error('清理旧日志失败:', error);
            throw error;
        }
    }
}
