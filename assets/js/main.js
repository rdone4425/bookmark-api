// 检查登录状态
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const loginTime = localStorage.getItem('loginTime');

    if (!isLoggedIn || !loginTime) {
        window.location.href = 'login.html';
        return false;
    }

    // 检查登录是否过期（24小时）
    const now = Date.now();
    const loginAge = now - parseInt(loginTime);
    const maxAge = 24 * 60 * 60 * 1000; // 24小时

    if (loginAge > maxAge) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('loginTime');
        window.location.href = 'login.html';
        return false;
    }

    return true;
}

function logout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('loginTime');
        window.location.href = 'login.html';
    }
}

// 更新时间显示
function updateDateTime() {
    const now = new Date();
    document.getElementById('datetime').textContent =
        now.toLocaleString('zh-CN', {
            hour12: false,
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
}

// 搜索书签
function searchBookmarks() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    const bookmarkItems = document.querySelectorAll('.bookmark-item');
    bookmarkItems.forEach(item => {
        const title = item.textContent.toLowerCase();
        const isMatch = title.includes(query.toLowerCase());
        item.style.display = isMatch ? '' : 'none';
    });
}

// 获取网站图标
function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
    }
}

// 获取分类图标
function getCategoryIcon(categoryName) {
    const iconMap = {
        '工作': '💼',
        '学习': '📚',
        '娱乐': '🎮',
        '工具': '🔧',
        '社交': '👥',
        '购物': '🛒',
        '新闻': '📰',
        '技术': '💻',
        '设计': '🎨',
        '音乐': '🎵',
        '视频': '📺',
        '其他': '📁'
    };
    return iconMap[categoryName] || '📁';
}

// 显示API文档
function showApiDocs() {
    const apiDocs = `
# 书签管理系统 API 文档

## 认证接口
- POST /api/auth/login - 用户登录
- POST /api/auth/logout - 用户退出

## 书签接口
- GET /api/bookmarks - 获取书签列表
- POST /api/bookmarks - 添加书签
- PUT /api/bookmarks/:id - 更新书签
- DELETE /api/bookmarks/:id - 删除书签

## 分类接口
- GET /api/categories - 获取分类统计
- POST /api/categories - 添加分类
- PUT /api/categories/:id - 更新分类
- DELETE /api/categories/:id - 删除分类

## 初始化接口
- POST /api/init - 初始化数据库
    `;

    alert(apiDocs);
}

// 全局变量
let allBookmarks = [];
let filteredBookmarks = [];
let allCategories = {};
let currentCategory = 'all';
let currentPage = 1;
let pageSize = 50;
let totalCount = 0;

// 加载书签数据
async function loadBookmarks() {
    const container = document.getElementById('bookmarkContainer');

    try {
        // 显示加载状态
        container.innerHTML = '<div class="loading">⏳ 正在加载书签...</div>';

        // 获取当前页的书签数据
        const params = new URLSearchParams({
            page: currentPage,
            limit: pageSize
        });

        if (currentCategory !== 'all') {
            params.append('category', currentCategory);
        }

        const response = await fetch(`/api/bookmarks?${params}`);
        const data = await response.json();

        if (!data.success) throw new Error(data.message);

        allBookmarks = data.书签 || [];
        totalCount = data.总数 || 0;

        console.log(`加载了第${currentPage}页，${allBookmarks.length}个书签，总数: ${totalCount}`);

        // 生成分类筛选按钮（只在第一次加载时）
        if (currentPage === 1) {
            await generateCategoryFilters();
        }

        // 显示书签
        displayBookmarks();

        // 更新分页控件
        updatePagination();

        // 设置搜索功能
        setupSearchFunction();

    } catch (error) {
        console.error('加载书签失败:', error);
        container.innerHTML = `<div class="error-message">❌ 加载失败: ${error.message}</div>`;
    }
}

// 生成分类筛选按钮
async function generateCategoryFilters() {
    try {
        // 获取分类统计信息
        const response = await fetch('/api/categories');
        const data = await response.json();

        if (!data.success) {
            console.error('获取分类统计失败:', data);
            return;
        }

        const categoryFiltersContainer = document.getElementById('categoryFilters');
        categoryFiltersContainer.innerHTML = '';

        // 使用实际的分类统计数据
        const categories = data.categories || [];
        const totalCount = data.total || 0;

        categories.forEach(category => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'category-filter-btn';
            button.dataset.category = category.name;
            button.textContent = `${getCategoryIcon(category.name)} ${category.name} (${category.count})`;

            button.addEventListener('click', () => {
                filterByCategory(category.name);
            });

            categoryFiltersContainer.appendChild(button);
        });

        // 设置"全部"按钮的事件和数量
        const allButton = document.querySelector('[data-category="all"]');
        if (allButton) {
            allButton.textContent = `📋 全部 (${totalCount})`;
            allButton.addEventListener('click', () => {
                filterByCategory('all');
            });
        }
    } catch (error) {
        console.error('生成分类筛选器失败:', error);
        // 如果API失败，使用默认分类
        generateDefaultCategories();
    }
}

// 生成默认分类（备用方案）
function generateDefaultCategories() {
    const categoryFiltersContainer = document.getElementById('categoryFilters');
    categoryFiltersContainer.innerHTML = '';

    const defaultCategories = ['工作', '学习', '娱乐', '工具', '其他'];

    defaultCategories.forEach(categoryName => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-filter-btn';
        button.dataset.category = categoryName;
        button.textContent = `${getCategoryIcon(categoryName)} ${categoryName}`;

        button.addEventListener('click', () => {
            filterByCategory(categoryName);
        });

        categoryFiltersContainer.appendChild(button);
    });

    // 设置"全部"按钮
    const allButton = document.querySelector('[data-category="all"]');
    if (allButton) {
        allButton.textContent = '📋 全部';
        allButton.addEventListener('click', () => {
            filterByCategory('all');
        });
    }
}

// 按分类筛选
function filterByCategory(category) {
    currentCategory = category;
    currentPage = 1; // 重置到第一页

    // 更新按钮状态
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');

    // 重新加载书签
    loadBookmarks();
}

// 显示书签
function displayBookmarks() {
    const container = document.getElementById('bookmarkContainer');
    container.innerHTML = '';

    if (allBookmarks.length === 0) {
        container.innerHTML = '<div class="empty-message">📭 暂无书签数据，请先添加一些书签</div>';
        return;
    }

    // 按分类整理当前页的书签
    const categories = {};
    allBookmarks.forEach(bookmark => {
        // 使用数据库中的category字段，而不是从path提取
        const category = bookmark.category || '其他';
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(bookmark);
    });

    // 如果选择了特定分类，只显示该分类
    let categoriesToShow = {};
    if (currentCategory === 'all') {
        categoriesToShow = categories;
    } else {
        if (categories[currentCategory]) {
            categoriesToShow[currentCategory] = categories[currentCategory];
        }
    }

    if (Object.keys(categoriesToShow).length === 0) {
        container.innerHTML = '<div class="empty-message">📭 该分类下暂无书签</div>';
        return;
    }

    for (const [category, items] of Object.entries(categoriesToShow)) {
        const section = document.createElement('div');
        section.className = 'category-section';
        section.dataset.category = category;

        const categoryTitle = document.createElement('h2');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = `${getCategoryIcon(category)} ${category} (${items.length})`;
        section.appendChild(categoryTitle);

        const bookmarkGrid = document.createElement('div');
        bookmarkGrid.className = 'bookmark-grid';

        items.forEach(bookmark => {
            const bookmarkItem = document.createElement('a');
            bookmarkItem.className = 'bookmark-item';
            bookmarkItem.href = bookmark.url;
            bookmarkItem.target = '_blank';
            bookmarkItem.rel = 'noopener';

            const favicon = document.createElement('img');
            favicon.src = getFaviconUrl(bookmark.url);
            favicon.className = 'bookmark-favicon';
            favicon.onerror = () => favicon.style.display = 'none';

            const title = document.createElement('span');
            title.className = 'bookmark-title';
            title.textContent = bookmark.标题 || bookmark.title || '无标题';

            bookmarkItem.appendChild(favicon);
            bookmarkItem.appendChild(title);
            bookmarkGrid.appendChild(bookmarkItem);
        });

        section.appendChild(bookmarkGrid);
        container.appendChild(section);
    }
}

// 更新分页控件
function updatePagination() {
    const paginationSection = document.getElementById('paginationSection');
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationNumbers = document.getElementById('paginationNumbers');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (totalCount <= pageSize) {
        paginationSection.classList.add('hidden');
        return;
    }

    paginationSection.classList.remove('hidden');

    // 更新信息显示
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalCount);
    paginationInfo.textContent = `显示 ${startItem}-${endItem} / 共 ${totalCount} 条`;

    // 更新按钮状态
    prevBtn.disabled = currentPage === 1;
    const totalPages = Math.ceil(totalCount / pageSize);
    nextBtn.disabled = currentPage === totalPages;

    // 生成页码按钮
    paginationNumbers.innerHTML = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.type = 'button';
        pageBtn.className = `pagination-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => goToPage(i));
        paginationNumbers.appendChild(pageBtn);
    }
}

// 跳转到指定页面
function goToPage(page) {
    currentPage = page;
    loadBookmarks();
}

// 设置分页事件监听器
function setupPaginationEvents() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageSizeSelect = document.getElementById('pageSize');

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(totalCount / pageSize);
        if (currentPage < totalPages) {
            goToPage(currentPage + 1);
        }
    });

    pageSizeSelect.addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value);
        currentPage = 1;
        loadBookmarks();
    });
}

// 设置搜索功能
function setupSearchFunction() {
    const searchInput = document.getElementById('searchInput');

    // 移除之前的事件监听器
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    newSearchInput.addEventListener('input', () => {
        const query = newSearchInput.value.toLowerCase();
        filterBookmarks(query);
    });

    newSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBookmarks();
        }
    });
}

// 筛选书签
function filterBookmarks(query) {
    const bookmarkItems = document.querySelectorAll('.bookmark-item');
    const categorySections = document.querySelectorAll('.category-section');

    if (!query) {
        // 如果没有搜索词，显示所有书签
        bookmarkItems.forEach(item => item.style.display = '');
        categorySections.forEach(section => section.style.display = '');
        return;
    }

    // 隐藏所有分类
    categorySections.forEach(section => {
        let hasVisibleItems = false;
        const items = section.querySelectorAll('.bookmark-item');

        items.forEach(item => {
            const title = item.querySelector('.bookmark-title').textContent.toLowerCase();
            const url = item.href.toLowerCase();
            const isMatch = title.includes(query) || url.includes(query);

            item.style.display = isMatch ? '' : 'none';
            if (isMatch) hasVisibleItems = true;
        });

        // 如果分类下有匹配的书签，显示该分类
        section.style.display = hasVisibleItems ? '' : 'none';
    });
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    // 检查登录状态
    if (!checkLoginStatus()) {
        return;
    }

    // 更新时间显示
    updateDateTime();
    setInterval(updateDateTime, 60000);

    // 设置分页事件监听器
    setupPaginationEvents();

    // 加载书签
    loadBookmarks();
});
