// Cloudflare Pages Functions - 书签API
import { DatabaseManager } from '../utils/database.js';
import { ResponseHelper } from '../utils/response.js';

// 数据库管理类已移动到 utils/database.js
// 响应处理类已移动到 utils/response.js

// 书签处理类
class BookmarkProcessor {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    async fullSync(bookmarks) {
        if (!Array.isArray(bookmarks)) {
            throw new Error('书签数据必须是数组格式');
        }

        let processed = 0;
        let errors = 0;

        for (const bookmark of bookmarks) {
            try {
                await this.upsertBookmark(bookmark);
                processed++;
            } catch (error) {
                console.error('处理书签失败:', bookmark, error);
                errors++;
            }
        }

        return {
            total: bookmarks.length,
            processed: processed,
            errors: errors
        };
    }

    async createBookmark(bookmark) {
        return await this.upsertBookmark(bookmark);
    }

    async updateBookmark(bookmark) {
        return await this.upsertBookmark(bookmark);
    }

    async removeBookmark(bookmark) {
        const deleteQuery = 'DELETE FROM bookmarks WHERE id = ? OR url = ?';
        const stmt = this.dbManager.db.prepare(deleteQuery);
        const result = await stmt.bind(bookmark.id, bookmark.url).run();
        return { deleted: result.changes || 0 };
    }

    async moveBookmark(bookmark) {
        return await this.upsertBookmark(bookmark);
    }

    async upsertBookmark(bookmark) {
        if (!bookmark.url) {
            throw new Error('书签URL不能为空');
        }

        const id = bookmark.id || this.generateId();
        const title = bookmark.title || '';
        const url = bookmark.url;
        const category = this.extractCategory(bookmark.path || '');
        const dateAdded = bookmark.dateAdded || Date.now();

        const upsertQuery = `
            INSERT OR REPLACE INTO bookmarks
            (id, title, url, category, path, date_added, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;

        const result = await this.dbManager.insert(upsertQuery, [
            id, title, url, category, bookmark.path || '', dateAdded
        ]);

        return { id: id, action: 'upserted' };
    }

    extractCategory(path) {
        if (!path) return '';
        const parts = path.split('/').filter(p => p.trim());
        return parts[0] || '';
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// 主要的请求处理函数
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // CORS 处理
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const dbManager = new DatabaseManager(env.DB);
        await dbManager.initializeTables();



        switch (method) {
            case 'GET':
                return await handleGetBookmarks(dbManager, url, corsHeaders);
            case 'POST':
                return await handlePostBookmarks(dbManager, request, corsHeaders);
            case 'PUT':
                return await handlePutBookmarks(dbManager, request, corsHeaders);
            case 'DELETE':
                return await handleDeleteBookmarks(dbManager, request, corsHeaders);
            default:
                return ResponseHelper.error('不支持的HTTP方法', 405, corsHeaders);
        }
    } catch (error) {
        console.error('API错误:', error);

        if (error.message.includes('DB is not defined') || error.message.includes('binding')) {
            return ResponseHelper.error(
                '数据库未正确配置。请确保在Cloudflare Pages设置中绑定了D1数据库。',
                500,
                corsHeaders
            );
        }

        return ResponseHelper.error(`服务器内部错误: ${error.message}`, 500, corsHeaders);
    }
}

// 处理GET请求
async function handleGetBookmarks(dbManager, url, corsHeaders) {
    try {
        const searchParams = url.searchParams;
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = Math.min(100, parseInt(searchParams.get('limit')) || 50);
        const search = searchParams.get('search') || '';
        const category = searchParams.get('category') || '';

        let whereClause = '';
        let params = [];

        // 构建WHERE条件
        const conditions = [];

        if (search) {
            conditions.push('(title LIKE ? OR url LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            conditions.push('category = ?');
            params.push(category);
        }

        if (conditions.length > 0) {
            whereClause = ' WHERE ' + conditions.join(' AND ');
        }

        const countQuery = `SELECT COUNT(*) as total FROM bookmarks${whereClause}`;
        const countResult = await dbManager.query(countQuery, params);
        const total = countResult.results?.[0]?.total || countResult[0]?.total || 0;

        const offset = (page - 1) * limit;
        const dataQuery = `
            SELECT id, title, url, category, subcategory, icon,
                   created_at, updated_at, date_added, path
            FROM bookmarks
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        const dataResult = await dbManager.query(dataQuery, [...params, limit, offset]);

        // 处理D1数据库返回的结果格式
        let bookmarks = [];
        if (dataResult && dataResult.results) {
            bookmarks = dataResult.results;
        } else if (Array.isArray(dataResult)) {
            bookmarks = dataResult;
        } else {
            console.log('意外的数据库结果格式:', dataResult);
            bookmarks = [];
        }

        const formattedBookmarks = bookmarks.map(bookmark => ({
            id: bookmark.id,
            标题: bookmark.title,
            title: bookmark.title,
            url: bookmark.url,
            分类: bookmark.category,
            category: bookmark.category,
            创建时间: bookmark.created_at,
            created_at: bookmark.created_at,
            dateAdded: bookmark.date_added,
            path: bookmark.path
        }));

        return ResponseHelper.success({
            success: true,
            总数: total,
            total: total,
            页码: page,
            page: page,
            每页数量: limit,
            limit: limit,
            总页数: Math.ceil(total / limit),
            书签: formattedBookmarks,
            bookmarks: formattedBookmarks
        }, corsHeaders);

    } catch (error) {
        console.error('获取书签失败:', error);
        return ResponseHelper.error(`获取书签失败: ${error.message}`, 500, corsHeaders);
    }
}

// 处理POST请求
async function handlePostBookmarks(dbManager, request, corsHeaders) {
    try {
        const body = await request.json();
        const { action, data } = body;

        console.log('收到同步请求:', { action, dataType: typeof data });

        const processor = new BookmarkProcessor(dbManager);
        let result;

        switch (action) {
            case 'fullSync':
                result = await processor.fullSync(data);
                break;
            case 'create':
                result = await processor.createBookmark(data);
                break;
            case 'update':
                result = await processor.updateBookmark(data);
                break;
            case 'remove':
                result = await processor.removeBookmark(data);
                break;
            case 'move':
                result = await processor.moveBookmark(data);
                break;
            default:
                return ResponseHelper.error('不支持的操作类型', 400, corsHeaders);
        }

        return ResponseHelper.success({
            success: true,
            action: action,
            message: '同步成功',
            result: result
        }, corsHeaders);

    } catch (error) {
        console.error('同步书签失败:', error);
        return ResponseHelper.error(`同步失败: ${error.message}`, 500, corsHeaders);
    }
}

// 处理PUT请求
async function handlePutBookmarks(dbManager, request, corsHeaders) {
    try {
        const body = await request.json();
        const { id, title, url, category } = body;

        if (!id) {
            return ResponseHelper.error('缺少书签ID', 400, corsHeaders);
        }

        const updateQuery = `
            UPDATE bookmarks
            SET title = ?, url = ?, category = ?, updated_at = datetime('now')
            WHERE id = ?
        `;

        const stmt = dbManager.db.prepare(updateQuery);
        const result = await stmt.bind(title || '', url || '', category || '', id).run();

        if (result.changes === 0) {
            return ResponseHelper.error('书签不存在', 404, corsHeaders);
        }

        return ResponseHelper.success({
            success: true,
            message: '书签更新成功',
            id: id
        }, corsHeaders);

    } catch (error) {
        console.error('更新书签失败:', error);
        return ResponseHelper.error(`更新失败: ${error.message}`, 500, corsHeaders);
    }
}

// 处理DELETE请求
async function handleDeleteBookmarks(dbManager, request, corsHeaders) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return ResponseHelper.error('缺少书签ID', 400, corsHeaders);
        }

        const deleteQuery = 'DELETE FROM bookmarks WHERE id = ?';
        const stmt = dbManager.db.prepare(deleteQuery);
        const result = await stmt.bind(id).run();

        if (result.changes === 0) {
            return ResponseHelper.error('书签不存在', 404, corsHeaders);
        }

        return ResponseHelper.success({
            success: true,
            message: '书签删除成功',
            id: id
        }, corsHeaders);

    } catch (error) {
        console.error('删除书签失败:', error);
        return ResponseHelper.error(`删除失败: ${error.message}`, 500, corsHeaders);
    }
}
