# 📚 书签管理系统

一个现代化的书签管理系统，采用紧凑UI设计，支持Chrome扩展同步。

## ✨ 功能特性

- **紧凑UI设计**: 信息密度最大化，减少滚动操作
- **Chrome扩展同步**: 实时监控浏览器书签变化并同步到云端
- **智能搜索**: 支持标题、URL、分类的快速搜索
- **分类管理**: 灵活的分类系统，支持层级分类
- **响应式设计**: 完美适配桌面端、平板、手机
- **管理后台**: 完整的管理界面，支持登录认证
- **API状态监控**: 实时显示API可用性
- **防抖优化**: 避免频繁同步，提升性能

## 📁 项目结构

```
bookmark-api/
├── public/                     # 前端页面目录
│   ├── index.html              # 主页（书签导航）
│   ├── admin.html              # 管理后台
│   ├── login.html              # 登录页面
│   └── setup.html              # 初始化设置页面
├── assets/                     # 静态资源目录
│   ├── css/
│   │   ├── main-compact.css    # 主页紧凑样式
│   │   └── admin.css           # 管理后台样式
│   └── js/
│       ├── main.js             # 主页逻辑
│       ├── admin.js            # 管理后台逻辑
│       └── login.js            # 登录逻辑
├── functions/                  # API后端目录
│   ├── api/
│   │   ├── bookmarks.js        # 书签管理API
│   │   ├── categories.js       # 分类管理API
│   │   ├── auth.js             # 认证API
│   │   └── init.js             # 初始化API
│   └── utils/
│       ├── database.js         # 数据库工具
│       └── response.js         # 响应工具
├── _redirects                  # URL重定向配置
├── _headers                    # HTTP头配置
└── README.md                   # 说明文档
```

## 🛠️ 部署步骤

### 1. 准备工作

1. 注册 [Cloudflare](https://cloudflare.com) 账户
2. 创建 GitHub 仓库并上传项目代码
3. 在 Cloudflare Dashboard 中创建 D1 数据库

### 2. 创建D1数据库

```bash
# 在Cloudflare Dashboard中创建D1数据库
# 数据库名称: bookmark-db
# 记录数据库ID，后续配置需要使用
```

### 3. 部署到Cloudflare Pages

1. 登录 Cloudflare Dashboard
2. 进入 Pages 页面，点击 "Create a project"
3. 选择 "Connect to Git"，连接你的 GitHub 仓库
4. 配置构建设置：
   - **Framework preset**: None
   - **Build command**: 留空
   - **Build output directory**: `/` (根目录)
   - **Root directory**: `bookmark-api`

### 4. 绑定D1数据库

1. 在 Pages 项目设置中，进入 "Functions" 标签
2. 在 "D1 database bindings" 部分添加绑定：
   - **Variable name**: `DB`
   - **D1 database**: 选择之前创建的数据库

### 5. 初始化数据库

部署完成后，需要初始化数据库：

**方法一：使用初始化页面（推荐）**
```
访问: https://你的项目名.pages.dev/setup
```

**方法二：使用API命令**
```bash
# 初始化数据库表
curl -X POST https://你的项目名.pages.dev/api/init \
  -H "Content-Type: application/json" \
  -d '{"action": "init_database"}'

# 创建管理员账户
curl -X POST https://你的项目名.pages.dev/api/init \
  -H "Content-Type: application/json" \
  -d '{"action": "create_admin"}'
```

**默认登录凭据：**
- 用户名: `admin`
- 密码: `admin123`

⚠️ **重要**: 首次登录后请立即修改默认密码！

### 6. 部署完成

你的API地址将是：
```
https://你的项目名.pages.dev/api/bookmarks
```

## 🔧 Chrome扩展配置

1. 安装Chrome扩展（从 `chrome/` 目录）
2. 点击扩展图标，进入设置
3. 输入API地址：`https://你的项目名.pages.dev/api/bookmarks`
4. 保存设置并测试连接

## 📊 API接口

### GET /api/bookmarks
获取书签列表

**参数:**
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 50, 最大: 100)
- `search`: 搜索关键词
- `category`: 分类筛选

**响应:**
```json
{
  "success": true,
  "总数": 100,
  "页码": 1,
  "每页数量": 50,
  "书签": [
    {
      "id": "bookmark_id",
      "标题": "书签标题",
      "url": "https://example.com",
      "分类": "工作",
      "创建时间": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/bookmarks
同步书签数据

**请求体:**
```json
{
  "action": "fullSync|create|update|remove|move",
  "data": "书签数据"
}
```

### PUT /api/bookmarks
更新书签

### DELETE /api/bookmarks?id=bookmark_id
删除书签

## 🎯 使用说明

### 首次部署流程
1. **部署项目**: 将代码部署到Cloudflare Pages
2. **绑定D1数据库**: 在Pages设置中绑定D1数据库（变量名：DB）
3. **系统初始化**: 访问任何页面会自动跳转到初始化向导 (`/setup.html`)
4. **完成配置**: 按照向导完成数据库表创建和管理员账户设置

### 初始化向导 (`/setup.html`)
系统会自动检查以下项目并引导完成配置：
- ✅ **D1数据库绑定检查**: 验证数据库是否正确绑定
- ✅ **数据库连接测试**: 确认数据库连接正常
- ✅ **数据库表创建**: 自动创建所需的表结构
- ✅ **管理员账户创建**: 设置默认管理员账户

如果检测到配置问题，向导会提供详细的手动配置步骤。

### 登录认证
- **登录页面**: `/login.html` （系统唯一入口）
- **默认凭据**: 用户名 `admin`，密码 `admin123`
- **会话管理**: 登录状态保持24小时
- **全站保护**: 主页、管理后台、测试页面都需要登录
- **安全提醒**: 首次登录后请及时修改默认密码

### 系统功能（登录后可访问）

#### 📊 主页面 (`/`)
- **API状态监控**: 实时显示API服务状态
- **统计信息**: 显示书签总数、今日同步等数据
- **最近书签**: 展示最新添加的书签
- **设置指南**: Chrome扩展配置说明
- **用户操作**: 显示登录用户信息，支持退出登录

#### 🛡️ 管理后台 (`/admin.html`)
- **仪表板**: 系统概览和状态监控
- **书签管理**: 搜索、筛选、删除书签
- **数据库管理**: 初始化、备份、清空数据
- **系统设置**: API配置、认证管理
- **用户管理**: 密码修改、会话管理

#### 🔧 API测试 (`/test.html`)
- **接口测试**: 测试所有API功能
- **连接验证**: 验证数据库连接状态
- **功能调试**: 开发和调试工具

### Chrome扩展功能
- **实时同步**: 自动监控书签变化
- **防抖机制**: 2秒防抖，避免频繁同步
- **状态指示**: 图标颜色反映API状态
- **手动同步**: 支持立即同步功能

## 🔒 安全说明

### 认证保护
- **全站登录保护**: 所有页面都需要登录才能访问
- **默认管理员账户**: `admin` / `admin123`
- **会话管理**: 登录状态保持24小时，过期自动跳转登录页
- **安全建议**: 部署后立即修改默认密码

### 数据安全
- **数据存储**: 所有数据存储在Cloudflare D1数据库中
- **API保护**: 支持CORS，可配置允许的域名
- **访问日志**: 记录登录和操作日志
- **数据备份**: 支持数据导出和备份功能

## 🐛 故障排除

### API返回500错误
**常见原因和解决方案：**

1. **数据库未绑定**
   - 错误信息：`DB is not defined`
   - 解决方案：在Cloudflare Pages设置中绑定D1数据库，变量名必须为 `DB`

2. **数据库权限问题**
   - 检查D1数据库是否正确创建
   - 确认Pages项目有访问数据库的权限

3. **SQL语法错误**
   - 查看Cloudflare Pages的实时日志
   - 检查数据库表是否正确创建

### API测试方法
访问 `https://你的项目名.pages.dev/test.html` 进行API测试：
- 测试API连接
- 测试数据库操作
- 查看详细错误信息

### Chrome扩展无法同步
1. **检查API地址格式**
   ```
   正确：https://你的项目名.pages.dev/api/bookmarks
   错误：https://你的项目名.pages.dev/api/
   错误：https://你的项目名.pages.dev/
   ```

2. **网络连接问题**
   - 检查CORS设置
   - 确认防火墙没有阻止请求
   - 测试API是否可以在浏览器中直接访问

3. **扩展权限问题**
   - 确认扩展有访问网络的权限
   - 检查扩展是否被浏览器阻止

### 数据库相关问题
1. **表不存在错误**
   - API会自动创建表，首次访问可能较慢
   - 可以访问管理后台手动初始化

2. **数据查询失败**
   - 检查D1数据库配额是否用完
   - 查看Cloudflare Dashboard中的数据库状态

3. **数据同步慢**
   - D1数据库在某些地区可能较慢
   - 这是正常现象，请耐心等待

### 部署相关问题
1. **Functions不工作**
   - 确认项目根目录结构正确
   - 检查 `functions/api/bookmarks.js` 文件路径

2. **静态文件404**
   - 确认构建输出目录设置为 `/`
   - 检查文件路径大小写

### 调试技巧
1. **查看浏览器控制台**
   - 打开开发者工具查看错误信息
   - 检查网络请求的响应内容

2. **查看Cloudflare日志**
   - 在Pages项目中查看Functions日志
   - 查看实时日志了解详细错误

3. **使用测试页面**
   - 访问 `/test.html` 进行API测试
   - 逐步测试各个功能点

## 📝 开发说明

### 本地开发
```bash
# 使用Cloudflare Pages本地开发工具
npx wrangler pages dev bookmark-api --d1 DB=your-database-id
```

### 代码结构
- 使用原生JavaScript，无框架依赖
- 模块化设计，功能分离
- 响应式布局，支持移动设备
- 完整的错误处理和用户反馈

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

**注意**: 这是一个演示项目，生产环境使用请注意安全配置和性能优化。
