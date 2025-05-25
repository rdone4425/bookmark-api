// Cloudflare Pages Functions - 系统初始化检查API
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // CORS 处理
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (method === 'GET') {
        return await handleSystemCheck(env, corsHeaders);
    }

    if (method === 'POST') {
        return await handleSystemInit(env, request, corsHeaders);
    }

    return new Response(JSON.stringify({
        success: false,
        error: '不支持的HTTP方法'
    }), {
        status: 405,
        headers: corsHeaders
    });
}

// 检查系统状态
async function handleSystemCheck(env, corsHeaders) {
    const status = {
        success: true,
        timestamp: new Date().toISOString(),
        checks: {
            database_binding: false,
            database_connection: false,
            tables_exist: false,
            admin_account: false
        },
        next_step: '',
        message: ''
    };

    try {
        // 1. 检查D1数据库绑定
        if (!env.DB) {
            status.checks.database_binding = false;
            status.next_step = 'bind_database';
            status.message = 'D1数据库未绑定。请在Cloudflare Pages设置中绑定D1数据库，变量名为 DB。';

            return new Response(JSON.stringify(status), {
                status: 200,
                headers: corsHeaders
            });
        }

        status.checks.database_binding = true;

        // 2. 检查数据库连接
        try {
            await env.DB.prepare('SELECT 1').first();
            status.checks.database_connection = true;
        } catch (error) {
            status.checks.database_connection = false;
            status.next_step = 'check_database';
            status.message = 'D1数据库连接失败。请检查数据库配置。';

            return new Response(JSON.stringify(status), {
                status: 200,
                headers: corsHeaders
            });
        }

        // 3. 检查表是否存在
        try {
            const tables = await env.DB.prepare(`
                SELECT name FROM sqlite_master
                WHERE type='table' AND name IN ('bookmarks', 'auth', 'login_logs')
            `).all();

            const tableNames = tables.results.map(t => t.name);
            const requiredTables = ['bookmarks', 'auth', 'login_logs'];
            const allTablesExist = requiredTables.every(table => tableNames.includes(table));

            if (!allTablesExist) {
                status.checks.tables_exist = false;
                status.next_step = 'init_database';
                status.message = '数据库表未创建。需要初始化数据库表结构。';

                return new Response(JSON.stringify(status), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            status.checks.tables_exist = true;
        } catch (error) {
            status.checks.tables_exist = false;
            status.next_step = 'init_database';
            status.message = '无法检查数据库表。需要初始化数据库。';

            return new Response(JSON.stringify(status), {
                status: 200,
                headers: corsHeaders
            });
        }

        // 4. 检查管理员账户
        try {
            const adminUser = await env.DB.prepare('SELECT id FROM auth WHERE username = ?')
                .bind('admin')
                .first();

            if (!adminUser) {
                status.checks.admin_account = false;
                status.next_step = 'create_admin';
                status.message = '管理员账户未创建。需要创建默认管理员账户。';

                return new Response(JSON.stringify(status), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            status.checks.admin_account = true;
        } catch (error) {
            status.checks.admin_account = false;
            status.next_step = 'create_admin';
            status.message = '无法检查管理员账户。需要创建管理员账户。';

            return new Response(JSON.stringify(status), {
                status: 200,
                headers: corsHeaders
            });
        }

        // 所有检查都通过
        status.next_step = 'ready';
        status.message = '系统已就绪，可以正常使用。';

        return new Response(JSON.stringify(status), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        console.error('系统检查失败:', error);

        return new Response(JSON.stringify({
            success: false,
            error: '系统检查失败',
            message: error.message,
            next_step: 'error'
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}

// 初始化系统
async function handleSystemInit(env, request, corsHeaders) {
    try {
        const body = await request.json();
        const { action } = body;

        if (!env.DB) {
            return new Response(JSON.stringify({
                success: false,
                error: 'D1数据库未绑定',
                message: '请先在Cloudflare Pages设置中绑定D1数据库'
            }), {
                status: 400,
                headers: corsHeaders
            });
        }

        switch (action) {
            case 'init_database':
                return await initDatabase(env.DB, corsHeaders);
            case 'create_admin':
                return await createAdminAccount(env.DB, corsHeaders);
            case 'create_sample_data':
                return await createSampleData(env.DB, corsHeaders);
            default:
                return new Response(JSON.stringify({
                    success: false,
                    error: '不支持的初始化操作'
                }), {
                    status: 400,
                    headers: corsHeaders
                });
        }

    } catch (error) {
        console.error('系统初始化失败:', error);

        return new Response(JSON.stringify({
            success: false,
            error: '系统初始化失败',
            message: error.message
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}

// 初始化数据库表
async function initDatabase(db, corsHeaders) {
    try {
        // 定义所有需要执行的SQL语句
        const sqlStatements = [
            // 创建书签表
            `CREATE TABLE IF NOT EXISTS bookmarks (
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
            )`,

            // 创建认证表
            `CREATE TABLE IF NOT EXISTS auth (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // 创建登录日志表
            `CREATE TABLE IF NOT EXISTS login_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                user_agent TEXT,
                FOREIGN KEY (user_id) REFERENCES auth (id)
            )`,

            // 创建索引
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url)',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title)',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category)',
            'CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_login_logs_login_time ON login_logs(login_time)'
        ];

        // 逐个执行SQL语句
        for (let i = 0; i < sqlStatements.length; i++) {
            const sql = sqlStatements[i].trim();
            console.log(`执行SQL ${i + 1}/${sqlStatements.length}:`, sql.substring(0, 50) + '...');

            try {
                await db.prepare(sql).run();
            } catch (sqlError) {
                console.error(`SQL执行失败 (${i + 1}/${sqlStatements.length}):`, sqlError);
                console.error('失败的SQL:', sql);
                throw new Error(`数据库表创建失败: ${sqlError.message}`);
            }
        }

        console.log('所有数据库表和索引创建完成');

        return new Response(JSON.stringify({
            success: true,
            message: '数据库表创建成功',
            action: 'init_database',
            details: `成功执行 ${sqlStatements.length} 个SQL语句`
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        console.error('数据库初始化失败:', error);

        return new Response(JSON.stringify({
            success: false,
            error: '数据库初始化失败',
            message: error.message,
            action: 'init_database'
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}

// 创建管理员账户
async function createAdminAccount(db, corsHeaders) {
    try {
        // 检查是否已存在管理员账户
        const existingAdmin = await db.prepare('SELECT id FROM auth WHERE username = ?')
            .bind('admin')
            .first();

        if (existingAdmin) {
            return new Response(JSON.stringify({
                success: true,
                message: '管理员账户已存在',
                action: 'create_admin'
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        // 创建默认管理员账户
        await db.prepare('INSERT INTO auth (username, password) VALUES (?, ?)')
            .bind('admin', 'admin123')
            .run();

        return new Response(JSON.stringify({
            success: true,
            message: '默认管理员账户创建成功 (admin/admin123)',
            action: 'create_admin'
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        console.error('创建管理员账户失败:', error);
        throw error;
    }
}

// 创建示例数据
async function createSampleData(db, corsHeaders) {
    try {
        // 检查是否已有数据
        const existingData = await db.prepare('SELECT COUNT(*) as count FROM bookmarks').first();

        if (existingData && existingData.count > 0) {
            return new Response(JSON.stringify({
                success: true,
                message: '数据库中已有数据，跳过示例数据创建',
                action: 'create_sample_data'
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        // 示例书签数据
        const sampleBookmarks = [
            {
                id: 'sample_1',
                title: 'Google',
                url: 'https://www.google.com',
                category: '搜索引擎',
                path: '搜索引擎/Google'
            },
            {
                id: 'sample_2',
                title: 'GitHub',
                url: 'https://github.com',
                category: '开发工具',
                path: '开发工具/代码托管'
            },
            {
                id: 'sample_3',
                title: 'Stack Overflow',
                url: 'https://stackoverflow.com',
                category: '开发工具',
                path: '开发工具/问答社区'
            },
            {
                id: 'sample_4',
                title: 'MDN Web Docs',
                url: 'https://developer.mozilla.org',
                category: '学习资源',
                path: '学习资源/Web开发'
            },
            {
                id: 'sample_5',
                title: 'Cloudflare',
                url: 'https://cloudflare.com',
                category: '云服务',
                path: '云服务/CDN'
            }
        ];

        // 插入示例数据
        for (const bookmark of sampleBookmarks) {
            await db.prepare(`
                INSERT INTO bookmarks (id, title, url, category, path, date_added, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).bind(
                bookmark.id,
                bookmark.title,
                bookmark.url,
                bookmark.category,
                bookmark.path,
                Date.now()
            ).run();
        }

        return new Response(JSON.stringify({
            success: true,
            message: `成功创建 ${sampleBookmarks.length} 条示例书签数据`,
            action: 'create_sample_data',
            count: sampleBookmarks.length
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        console.error('创建示例数据失败:', error);

        return new Response(JSON.stringify({
            success: false,
            error: '创建示例数据失败',
            message: error.message,
            action: 'create_sample_data'
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
