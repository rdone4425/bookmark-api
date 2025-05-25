// 分类统计API
import { DatabaseManager } from '../utils/database.js';
import { ResponseHelper } from '../utils/response.js';

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // CORS 处理
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const dbManager = new DatabaseManager(env.DB);
        await dbManager.initializeTables();

        if (method === 'GET') {
            return await handleGetCategories(dbManager, corsHeaders);
        } else {
            return ResponseHelper.error('不支持的HTTP方法', 405, corsHeaders);
        }
    } catch (error) {
        console.error('分类API错误:', error);

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

// 处理分类统计请求
async function handleGetCategories(dbManager, corsHeaders) {
    try {
        const categoryQuery = `
            SELECT 
                CASE 
                    WHEN category IS NULL OR category = '' THEN '其他'
                    ELSE category 
                END as category_name,
                COUNT(*) as count
            FROM bookmarks 
            GROUP BY category_name
            ORDER BY count DESC, category_name ASC
        `;

        const result = await dbManager.query(categoryQuery);
        
        // 处理D1数据库返回的结果格式
        let categories = [];
        if (result && result.results) {
            categories = result.results;
        } else if (Array.isArray(result)) {
            categories = result;
        }

        // 格式化返回数据
        const formattedCategories = categories.map(cat => ({
            name: cat.category_name,
            count: cat.count
        }));

        // 计算总数
        const total = categories.reduce((sum, cat) => sum + cat.count, 0);

        return ResponseHelper.success({
            success: true,
            categories: formattedCategories,
            total: total,
            message: `找到 ${categories.length} 个分类，共 ${total} 个书签`
        }, corsHeaders);

    } catch (error) {
        console.error('获取分类统计失败:', error);
        return ResponseHelper.error(`获取分类统计失败: ${error.message}`, 500, corsHeaders);
    }
}
