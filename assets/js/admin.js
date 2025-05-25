// 管理后台JavaScript逻辑
(function() {
    'use strict';

    // 配置
    const CONFIG = {
        apiBaseUrl: '/api',
        pageSize: 20,
        refreshInterval: 30000
    };

    // 主应用类
    class AdminApp {
        constructor() {
            this.currentTab = 'dashboard';
            this.currentPage = 1;
            this.currentSearch = '';
            this.currentCategory = '';
            this.init();
        }

        async init() {
            this.setupEventListeners();
            this.updateApiUrl();
            await this.loadDashboard();
            this.startAutoRefresh();
        }

        setupEventListeners() {
            console.log('设置事件监听器...');

            // 标签页切换
            const navBtns = document.querySelectorAll('.nav-btn');
            console.log('找到导航按钮数量:', navBtns.length);

            navBtns.forEach(btn => {
                console.log('绑定按钮:', btn.dataset.tab);
                btn.addEventListener('click', (e) => {
                    console.log('点击标签页:', e.target.dataset.tab);
                    this.switchTab(e.target.dataset.tab);
                });
            });

            this.setupAuthEvents();
        }

        setupAuthEvents() {
            // 返回前台
            const backBtn = document.getElementById('back-to-frontend');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    this.backToFrontend();
                });
            }

            // 退出登录
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    this.logout();
                });
            }
        }

        backToFrontend() {
            // 跳转到前台首页
            window.location.href = 'index.html';
        }

        logout() {
            if (confirm('确定要退出登录吗？')) {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('loginTime');
                window.location.href = 'login.html';
            }
        }

        switchTab(tabName) {
            console.log('切换到标签页:', tabName);

            // 更新导航按钮状态
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
                console.log('激活按钮:', tabName);
            } else {
                console.error('找不到按钮:', tabName);
            }

            // 显示对应的内容
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            const activeContent = document.getElementById(tabName);
            if (activeContent) {
                activeContent.classList.add('active');
                console.log('显示内容:', tabName);
            } else {
                console.error('找不到内容区域:', tabName);
            }

            this.currentTab = tabName;

            // 加载对应的数据
            switch (tabName) {
                case 'dashboard':
                    this.loadDashboard();
                    break;
                case 'bookmarks':
                    this.loadBookmarks();
                    break;
                case 'categories':
                    this.loadCategoryManagement();
                    break;
                case 'database':
                    this.loadDatabaseInfo();
                    break;
                case 'settings':
                    this.loadSettings();
                    break;
            }
        }

        updateApiUrl() {
            const apiUrlElement = document.getElementById('api-url-setting');
            if (apiUrlElement) {
                const currentDomain = window.location.origin;
                apiUrlElement.value = `${currentDomain}/api/bookmarks`;
            }
        }

        async loadDashboard() {
            await Promise.all([
                this.loadStats(),
                this.checkApiStatus(),
                this.loadSystemInfo()
            ]);
        }

        async loadStats() {
            try {
                const response = await fetch(`${CONFIG.apiBaseUrl}/bookmarks`);
                if (response.ok) {
                    const data = await response.json();

                    this.updateElement('total-count', data.总数 || 0);
                    this.updateElement('today-count', '-');
                    this.updateElement('category-count', '-');
                }
            } catch (error) {
                console.error('加载统计数据失败:', error);
                this.updateElement('total-count', '错误');
                this.updateElement('today-count', '错误');
                this.updateElement('category-count', '错误');
            }
        }

        async checkApiStatus() {
            const statusIcon = document.getElementById('api-status-icon');
            const statusText = document.getElementById('api-status-text');

            try {
                statusText.textContent = '检查中...';
                statusIcon.textContent = '🔄';

                const response = await fetch(`${CONFIG.apiBaseUrl}/bookmarks`);

                if (response.ok) {
                    const data = await response.json();

                    if (data.success) {
                        statusText.textContent = '正常';
                        statusIcon.textContent = '✅';
                    } else {
                        throw new Error(data.message || '服务响应异常');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('API状态检查失败:', error);
                statusText.textContent = '异常';
                statusIcon.textContent = '❌';
            }
        }

        async loadSystemInfo() {
            // 更新部署时间
            this.updateElement('deploy-time', new Date().toLocaleDateString('zh-CN'));
            
            // 更新最后更新时间
            this.updateElement('last-update', '刚刚');
            
            // 更新数据库状态
            this.updateElement('db-status', '正常');
        }

        async loadBookmarks() {
            // 书签管理功能占位
            console.log('加载书签管理...');
        }

        async loadCategoryManagement() {
            // 分类管理功能占位
            console.log('加载分类管理...');
        }

        async loadDatabaseInfo() {
            // 数据库管理功能占位
            console.log('加载数据库信息...');
        }

        async loadSettings() {
            // 设置功能占位
            console.log('加载设置...');
        }

        updateElement(id, content) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = content;
            }
        }

        startAutoRefresh() {
            // 每30秒自动刷新仪表板数据
            setInterval(() => {
                if (this.currentTab === 'dashboard') {
                    this.loadStats();
                    this.checkApiStatus();
                }
            }, CONFIG.refreshInterval);
        }
    }

    // 全局函数
    window.switchToTab = function(tabName) {
        if (window.adminApp) {
            window.adminApp.switchTab(tabName);
        }
    };

    // 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', () => {
        // 检查登录状态
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        const loginTime = localStorage.getItem('loginTime');

        if (!isLoggedIn || !loginTime) {
            window.location.href = 'login.html';
            return;
        }

        // 检查登录是否过期（24小时）
        const now = Date.now();
        const loginAge = now - parseInt(loginTime);
        const maxAge = 24 * 60 * 60 * 1000; // 24小时

        if (loginAge > maxAge) {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('loginTime');
            window.location.href = 'login.html';
            return;
        }

        // 初始化管理应用
        window.adminApp = new AdminApp();
    });

})();
