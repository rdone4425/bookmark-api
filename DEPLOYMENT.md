# 书签管理系统 - 部署指南

## 📋 部署概述

本系统支持多种部署方式，推荐使用Cloudflare Pages + Workers + D1数据库的组合，也支持传统的Node.js部署。

## 🌐 Cloudflare Pages 部署（推荐）

### 1. 准备工作

#### 1.1 账户要求
- Cloudflare账户（免费版即可）
- GitHub账户（用于代码托管）

#### 1.2 项目结构
```
bookmark-api/
├── src/                 # 前端文件（部署到Pages）
│   ├── pages/          # HTML页面
│   └── assets/         # CSS和JS资源
├── functions/          # Worker函数（API后端）
└── wrangler.toml      # Cloudflare配置文件
```

### 2. 部署步骤

#### 2.1 创建D1数据库
```bash
# 登录Cloudflare
npx wrangler login

# 创建D1数据库
npx wrangler d1 create bookmark-db

# 记录数据库ID，用于后续配置
```

#### 2.2 配置wrangler.toml
```toml
name = "bookmark-api"
compatibility_date = "2024-01-01"

[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "bookmark-db"
database_id = "your-database-id-here"
```

#### 2.3 初始化数据库
```bash
# 创建数据库表
npx wrangler d1 execute bookmark-db --file=./schema.sql
```

#### 2.4 部署到Cloudflare Pages

**方法一：通过Cloudflare Dashboard**
1. 登录Cloudflare Dashboard
2. 进入Pages页面
3. 点击"创建项目"
4. 连接GitHub仓库
5. 设置构建配置：
   - 构建命令：`echo "No build needed"`
   - 构建输出目录：`src`
   - 根目录：`/`

**方法二：通过命令行**
```bash
# 部署Pages
npx wrangler pages deploy src --project-name=bookmark-api

# 部署Workers函数
npx wrangler deploy
```

#### 2.5 绑定D1数据库
在Cloudflare Dashboard中：
1. 进入Pages项目设置
2. 找到"Functions"标签
3. 添加D1数据库绑定：
   - 变量名：`DB`
   - 数据库：选择之前创建的`bookmark-db`

### 3. 环境变量配置

在Cloudflare Pages设置中添加环境变量：
```
NODE_ENV=production
API_BASE_URL=https://your-domain.pages.dev
```

## 🖥️ Node.js 部署

### 1. 服务器要求
- Node.js 18+
- SQLite3 或 PostgreSQL
- Nginx（可选，用于反向代理）

### 2. 部署步骤

#### 2.1 安装依赖
```bash
npm install
```

#### 2.2 配置环境变量
创建`.env`文件：
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=sqlite:./data/bookmarks.db
JWT_SECRET=your-jwt-secret-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

#### 2.3 初始化数据库
```bash
npm run db:init
```

#### 2.4 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 使用PM2（推荐）
npm install -g pm2
pm2 start ecosystem.config.js
```

#### 2.5 Nginx配置（可选）
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🐳 Docker 部署

### 1. Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### 2. docker-compose.yml
```yaml
version: '3.8'

services:
  bookmark-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=sqlite:/app/data/bookmarks.db
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - bookmark-api
    restart: unless-stopped
```

### 3. 部署命令
```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 🔧 配置说明

### 1. 数据库配置

#### SQLite（默认）
```javascript
const dbConfig = {
  client: 'sqlite3',
  connection: {
    filename: './data/bookmarks.db'
  }
};
```

#### PostgreSQL
```javascript
const dbConfig = {
  client: 'postgresql',
  connection: {
    host: 'localhost',
    user: 'bookmark_user',
    password: 'password',
    database: 'bookmark_db'
  }
};
```

### 2. 认证配置
```javascript
const authConfig = {
  jwtSecret: process.env.JWT_SECRET,
  tokenExpiry: '24h',
  defaultAdmin: {
    username: 'admin',
    password: 'admin123'
  }
};
```

### 3. API配置
```javascript
const apiConfig = {
  baseUrl: process.env.API_BASE_URL,
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100 // 最大请求数
  }
};
```

## 🔒 安全配置

### 1. HTTPS配置
```bash
# 使用Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

### 2. 防火墙配置
```bash
# UFW配置
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 3. 安全头配置
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));
```

## 📊 监控和日志

### 1. 日志配置
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 2. 健康检查
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

## 🚀 性能优化

### 1. 缓存配置
```javascript
const redis = require('redis');
const client = redis.createClient();

// API响应缓存
app.use('/api', cache('5 minutes'));
```

### 2. 压缩配置
```javascript
const compression = require('compression');
app.use(compression());
```

### 3. 静态文件优化
```javascript
app.use(express.static('public', {
  maxAge: '1d',
  etag: true
}));
```

## 🔄 备份和恢复

### 1. 数据库备份
```bash
# SQLite备份
cp data/bookmarks.db backup/bookmarks-$(date +%Y%m%d).db

# PostgreSQL备份
pg_dump bookmark_db > backup/bookmarks-$(date +%Y%m%d).sql
```

### 2. 自动备份脚本
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/path/to/backup"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp data/bookmarks.db $BACKUP_DIR/bookmarks_$DATE.db

# 清理旧备份（保留7天）
find $BACKUP_DIR -name "bookmarks_*.db" -mtime +7 -delete

echo "Backup completed: bookmarks_$DATE.db"
```

### 3. 定时备份
```bash
# 添加到crontab
0 2 * * * /path/to/backup.sh
```

---

*此部署指南涵盖了多种部署方式和配置选项，请根据实际需求选择合适的部署方案。*
