// 响应处理工具类
export class ResponseHelper {
    // 成功响应
    static success(data, headers = {}) {
        const defaultHeaders = {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...defaultHeaders, ...headers }
        });
    }

    // 错误响应
    static error(message, status = 400, headers = {}) {
        const defaultHeaders = {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };

        const errorData = {
            success: false,
            error: message,
            message: message,
            status: status,
            timestamp: new Date().toISOString()
        };

        return new Response(JSON.stringify(errorData), {
            status: status,
            headers: { ...defaultHeaders, ...headers }
        });
    }

    // 重定向响应
    static redirect(url, status = 302) {
        return new Response(null, {
            status: status,
            headers: {
                'Location': url
            }
        });
    }

    // HTML响应
    static html(content, status = 200, headers = {}) {
        const defaultHeaders = {
            'Content-Type': 'text/html; charset=utf-8'
        };

        return new Response(content, {
            status: status,
            headers: { ...defaultHeaders, ...headers }
        });
    }

    // JSON响应（通用）
    static json(data, status = 200, headers = {}) {
        const defaultHeaders = {
            'Content-Type': 'application/json; charset=utf-8'
        };

        return new Response(JSON.stringify(data), {
            status: status,
            headers: { ...defaultHeaders, ...headers }
        });
    }

    // 文件下载响应
    static download(data, filename, contentType = 'application/octet-stream') {
        const headers = {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-cache'
        };

        return new Response(data, {
            status: 200,
            headers: headers
        });
    }

    // 处理CORS预检请求
    static cors(allowedOrigins = ['*'], allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
        return {
            'Access-Control-Allow-Origin': allowedOrigins.join(', '),
            'Access-Control-Allow-Methods': allowedMethods.join(', '),
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        };
    }

    // 验证请求体
    static async validateRequestBody(request, requiredFields = []) {
        try {
            const body = await request.json();
            
            // 检查必需字段
            for (const field of requiredFields) {
                if (!(field in body) || body[field] === undefined || body[field] === null) {
                    throw new Error(`缺少必需字段: ${field}`);
                }
            }

            return body;
        } catch (error) {
            if (error.message.includes('缺少必需字段')) {
                throw error;
            }
            throw new Error('请求体格式错误，必须是有效的JSON');
        }
    }

    // 获取客户端IP地址
    static getClientIP(request) {
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

    // 获取用户代理
    static getUserAgent(request) {
        return request.headers.get('User-Agent') || 'unknown';
    }

    // 验证URL格式
    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // 清理和验证输入数据
    static sanitizeInput(input, maxLength = 1000) {
        if (typeof input !== 'string') {
            return String(input);
        }

        // 移除潜在的危险字符
        let sanitized = input
            .replace(/[<>]/g, '') // 移除尖括号
            .replace(/javascript:/gi, '') // 移除javascript协议
            .replace(/data:/gi, '') // 移除data协议
            .trim();

        // 限制长度
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }

        return sanitized;
    }

    // 生成唯一ID
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 格式化错误信息
    static formatError(error) {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            };
        }
        return { message: String(error) };
    }

    // 分页参数验证
    static validatePaginationParams(searchParams) {
        const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit')) || 20));
        const offset = (page - 1) * limit;

        return { page, limit, offset };
    }

    // 搜索参数清理
    static sanitizeSearchParams(searchParams) {
        const search = this.sanitizeInput(searchParams.get('search') || '', 100);
        const category = this.sanitizeInput(searchParams.get('category') || '', 50);
        const sortBy = this.sanitizeInput(searchParams.get('sortBy') || 'created_at', 20);
        const sortOrder = ['asc', 'desc'].includes(searchParams.get('sortOrder')) ? 
            searchParams.get('sortOrder') : 'desc';

        return { search, category, sortBy, sortOrder };
    }

    // 构建分页响应
    static buildPaginatedResponse(data, total, page, limit, additionalData = {}) {
        const totalPages = Math.ceil(total / limit);
        
        return {
            success: true,
            data: data,
            pagination: {
                page: page,
                limit: limit,
                total: total,
                totalPages: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            ...additionalData
        };
    }

    // 记录API访问日志
    static logApiAccess(request, response, startTime) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const method = request.method;
        const url = new URL(request.url);
        const path = url.pathname;
        const userAgent = this.getUserAgent(request);
        const clientIP = this.getClientIP(request);

        console.log(`API访问: ${method} ${path} - ${response.status} - ${duration}ms - ${clientIP} - ${userAgent}`);
    }
}
