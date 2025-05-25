// Cloudflare Pages Functions - 认证API
import { DatabaseManager } from '../utils/database.js';
import { ResponseHelper } from '../utils/response.js';

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
            case 'POST':
                return await handleLogin(dbManager, request, corsHeaders);
            case 'PUT':
                return await handleUpdatePassword(dbManager, request, corsHeaders);
            case 'GET':
                return await handleCheckAuth(dbManager, request, corsHeaders);
            default:
                return ResponseHelper.error('不支持的HTTP方法', 405, corsHeaders);
        }
    } catch (error) {
        console.error('认证API错误:', error);
        
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

// 处理登录请求
async function handleLogin(dbManager, request, corsHeaders) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return ResponseHelper.error('用户名和密码不能为空', 400, corsHeaders);
        }

        // 查询用户
        const user = await dbManager.queryFirst(
            'SELECT * FROM auth WHERE username = ?',
            [username]
        );

        if (!user) {
            return ResponseHelper.error('用户不存在', 401, corsHeaders);
        }

        // 验证密码（实际项目中应该使用哈希密码）
        if (user.password !== password) {
            return ResponseHelper.error('密码错误', 401, corsHeaders);
        }

        // 生成简单的token（实际项目中应该使用JWT）
        const token = generateSimpleToken(user.id, user.username);

        // 记录登录日志
        await dbManager.insert(
            'INSERT INTO login_logs (user_id, username, login_time, ip_address) VALUES (?, ?, datetime("now"), ?)',
            [user.id, user.username, getClientIP(request)]
        );

        return ResponseHelper.success({
            success: true,
            message: '登录成功',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                created_at: user.created_at
            }
        }, corsHeaders);

    } catch (error) {
        console.error('登录处理失败:', error);
        return ResponseHelper.error(`登录失败: ${error.message}`, 500, corsHeaders);
    }
}

// 处理密码更新请求
async function handleUpdatePassword(dbManager, request, corsHeaders) {
    try {
        const body = await request.json();
        const { username, oldPassword, newPassword } = body;

        if (!username || !oldPassword || !newPassword) {
            return ResponseHelper.error('所有字段都不能为空', 400, corsHeaders);
        }

        if (newPassword.length < 6) {
            return ResponseHelper.error('新密码长度不能少于6位', 400, corsHeaders);
        }

        // 验证旧密码
        const user = await dbManager.queryFirst(
            'SELECT * FROM auth WHERE username = ?',
            [username]
        );

        if (!user || user.password !== oldPassword) {
            return ResponseHelper.error('用户名或原密码错误', 401, corsHeaders);
        }

        // 更新密码
        const stmt = dbManager.db.prepare(
            'UPDATE auth SET password = ?, updated_at = datetime("now") WHERE username = ?'
        );
        const result = await stmt.bind(newPassword, username).run();

        if (result.changes === 0) {
            return ResponseHelper.error('密码更新失败', 500, corsHeaders);
        }

        return ResponseHelper.success({
            success: true,
            message: '密码更新成功'
        }, corsHeaders);

    } catch (error) {
        console.error('密码更新失败:', error);
        return ResponseHelper.error(`密码更新失败: ${error.message}`, 500, corsHeaders);
    }
}

// 检查认证状态
async function handleCheckAuth(dbManager, request, corsHeaders) {
    try {
        const authHeader = request.headers.get('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return ResponseHelper.error('未提供认证令牌', 401, corsHeaders);
        }

        const token = authHeader.substring(7);
        const decoded = decodeSimpleToken(token);

        if (!decoded) {
            return ResponseHelper.error('无效的认证令牌', 401, corsHeaders);
        }

        // 验证用户是否存在
        const user = await dbManager.queryFirst(
            'SELECT id, username, created_at FROM auth WHERE id = ?',
            [decoded.userId]
        );

        if (!user) {
            return ResponseHelper.error('用户不存在', 401, corsHeaders);
        }

        return ResponseHelper.success({
            success: true,
            user: user,
            tokenValid: true
        }, corsHeaders);

    } catch (error) {
        console.error('认证检查失败:', error);
        return ResponseHelper.error(`认证检查失败: ${error.message}`, 500, corsHeaders);
    }
}

// 生成简单的token（实际项目中应该使用JWT）
function generateSimpleToken(userId, username) {
    const payload = {
        userId: userId,
        username: username,
        timestamp: Date.now()
    };
    
    // 简单的base64编码（实际项目中应该使用加密）
    return btoa(JSON.stringify(payload));
}

// 解码简单的token
function decodeSimpleToken(token) {
    try {
        const payload = JSON.parse(atob(token));
        
        // 检查token是否过期（24小时）
        const now = Date.now();
        const tokenAge = now - payload.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24小时
        
        if (tokenAge > maxAge) {
            return null; // token已过期
        }
        
        return payload;
    } catch (error) {
        return null;
    }
}

// 获取客户端IP地址
function getClientIP(request) {
    // Cloudflare 提供的真实IP
    const cfConnectingIP = request.headers.get('CF-Connecting-IP');
    if (cfConnectingIP) {
        return cfConnectingIP;
    }

    // 其他常见的IP头
    const xForwardedFor = request.headers.get('X-Forwarded-For');
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }

    const xRealIP = request.headers.get('X-Real-IP');
    if (xRealIP) {
        return xRealIP;
    }

    return 'unknown';
}
