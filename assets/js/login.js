class LoginManager {
    constructor() {
        this.apiBase = '/api';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkSystemStatus();
    }

    setupEventListeners() {
        const form = document.getElementById('login-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // 回车键登录
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleLogin();
            }
        });
    }

    async checkSystemStatus() {
        try {
            // 简单的系统检查
            const response = await fetch('/api/bookmarks');
            if (response.ok) {
                this.showSuccess('系统已就绪，请登录');
            } else {
                this.showError('系统可能需要初始化，请联系管理员');
            }
        } catch (error) {
            console.error('系统检查失败:', error);
            this.showError('无法连接到服务器，请检查网络连接');
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showError('请输入用户名和密码');
            return;
        }

        this.showLoading(true);
        this.hideMessages();

        try {
            // 模拟登录验证（实际项目中应该调用后端API）
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (username === 'admin' && password === 'admin123') {
                // 登录成功，保存登录状态
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('loginTime', Date.now().toString());

                this.showSuccess('登录成功！正在跳转...');

                setTimeout(() => {
                    // 检查是否有来源页面，如果有则返回，否则去主页
                    const returnUrl = new URLSearchParams(window.location.search).get('return') || 'index.html';
                    window.location.href = returnUrl;
                }, 1000);
            } else {
                throw new Error('用户名或密码错误');
            }
        } catch (error) {
            console.error('登录失败:', error);
            this.showError(error.message || '登录失败，请重试');
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const button = document.getElementById('login-button');

        loading.style.display = show ? 'block' : 'none';
        button.disabled = show;
    }

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    showSuccess(message) {
        const successDiv = document.getElementById('success-message');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
    }

    hideMessages() {
        document.getElementById('error-message').style.display = 'none';
        document.getElementById('success-message').style.display = 'none';
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 如果已经登录，直接跳转
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const loginTime = localStorage.getItem('loginTime');

    if (isLoggedIn && loginTime) {
        // 检查登录是否过期（24小时）
        const now = Date.now();
        const loginAge = now - parseInt(loginTime);
        const maxAge = 24 * 60 * 60 * 1000; // 24小时

        if (loginAge <= maxAge) {
            // 登录仍然有效，跳转到主页
            const returnUrl = new URLSearchParams(window.location.search).get('return') || 'index.html';
            window.location.href = returnUrl;
            return;
        } else {
            // 登录已过期，清除状态
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('loginTime');
        }
    }

    // 初始化登录管理器
    new LoginManager();
});
