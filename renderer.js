// 全局状态
let allApps = [];
let groups = [];
let selectedApps = new Set();
let currentGroupId = null;
let isScanning = false;
let currentTheme = 'dark';
let appIcons = {}; // 缓存应用图标

// DOM 元素
const elements = {
    groupsList: document.getElementById('groupsList'),
    appsGrid: document.getElementById('appsGrid'),
    loadingState: document.getElementById('loadingState'),
    emptyState: document.getElementById('emptyState'),
    scanBtn: document.getElementById('scanBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    searchInput: document.getElementById('searchInput'),
    addGroupBtn: document.getElementById('addGroupBtn'),
    actionBar: document.getElementById('actionBar'),
    groupActionBar: document.getElementById('groupActionBar'),
    selectedCount: document.getElementById('selectedCount'),
    appCount: document.getElementById('appCount'),
    currentView: document.getElementById('currentView'),
    addGroupModal: document.getElementById('addGroupModal'),
    selectGroupModal: document.getElementById('selectGroupModal'),
    renameGroupModal: document.getElementById('renameGroupModal'),
    groupNameInput: document.getElementById('groupNameInput'),
    renameGroupInput: document.getElementById('renameGroupInput'),
    groupSelectList: document.getElementById('groupSelectList'),
    toastContainer: document.getElementById('toastContainer'),
    addToGroupBtn: document.getElementById('addToGroupBtn'),
    cancelSelectBtn: document.getElementById('cancelSelectBtn'),
    quickLaunchBtn: document.getElementById('quickLaunchBtn'),
    removeFromGroupBtn: document.getElementById('removeFromGroupBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    themeSwitcher: document.getElementById('themeSwitcher'),
    storagePathInput: document.getElementById('storagePathInput'),
    browseStoragePathBtn: document.getElementById('browseStoragePathBtn'),
    resetStoragePathBtn: document.getElementById('resetStoragePathBtn'),
    addPortableBtn: document.getElementById('addPortableBtn'),
    addPortableModal: document.getElementById('addPortableModal'),
    portableNameInput: document.getElementById('portableNameInput'),
    portablePathInput: document.getElementById('portablePathInput'),
    portablePublisherInput: document.getElementById('portablePublisherInput'),
    browseExeBtn: document.getElementById('browseExeBtn')
};

// 初始化
async function init() {
    await loadSettings();
    await loadGroups();
    renderGroups();
    setupEventListeners();

    // 初始显示空状态
    elements.loadingState.style.display = 'none';
    elements.emptyState.style.display = 'flex';
}

// 加载设置
async function loadSettings() {
    try {
        const settings = await window.electronAPI.getSettings();
        currentTheme = settings.theme || 'dark';
        applyTheme(currentTheme);
        
        // 更新存储路径显示
        if (elements.storagePathInput) {
            elements.storagePathInput.value = settings.dataDir || settings.defaultDataDir;
        }
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

// 应用主题
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // 更新设置弹窗中的主题选择器
    updateThemeSwitcher(theme);
}

// 更新主题切换器状态
function updateThemeSwitcher(theme) {
    if (elements.themeSwitcher) {
        elements.themeSwitcher.querySelectorAll('.theme-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }
}

// 切换主题
async function switchTheme(theme) {
    currentTheme = theme;
    applyTheme(currentTheme);
    await window.electronAPI.saveTheme(currentTheme);
    showToast(`已切换到${currentTheme === 'dark' ? '深色' : '浅色'}主题`, 'success');
}

// 打开设置弹窗
async function openSettings() {
    // 刷新设置数据
    try {
        const settings = await window.electronAPI.getSettings();
        elements.storagePathInput.value = settings.dataDir || settings.defaultDataDir;
        updateThemeSwitcher(settings.theme || 'dark');
    } catch (error) {
        console.error('加载设置失败:', error);
    }
    showModal('settingsModal');
}

// 浏览选择存储目录
async function browseStoragePath() {
    try {
        const result = await window.electronAPI.selectStorageDir();
        if (result && result.dirPath) {
            elements.storagePathInput.value = result.dirPath;
            
            // 保存新的存储目录
            await window.electronAPI.saveSettings({ dataDir: result.dirPath });
            showToast('存储目录已更新，重启应用后生效', 'info');
        }
    } catch (error) {
        showToast('选择目录失败', 'error');
    }
}

// 重置存储目录为默认值
async function resetStoragePath() {
    try {
        const settings = await window.electronAPI.getSettings();
        elements.storagePathInput.value = settings.defaultDataDir;
        
        // 保存默认存储目录
        await window.electronAPI.saveSettings({ dataDir: settings.defaultDataDir });
        showToast('存储目录已重置为默认位置', 'success');
    } catch (error) {
        showToast('重置失败', 'error');
    }
}

// 设置事件监听器
function setupEventListeners() {
    elements.scanBtn.addEventListener('click', scanApps);
    elements.refreshBtn.addEventListener('click', refreshStatus);
    elements.searchInput.addEventListener('input', handleSearch);
    elements.addGroupBtn.addEventListener('click', () => showModal('addGroupModal'));
    elements.addToGroupBtn.addEventListener('click', () => showModal('selectGroupModal'));
    elements.cancelSelectBtn.addEventListener('click', clearSelection);
    elements.quickLaunchBtn.addEventListener('click', quickLaunchGroup);
    elements.removeFromGroupBtn.addEventListener('click', removeFromGroup);

    // 设置按钮和弹窗
    elements.settingsBtn.addEventListener('click', openSettings);
    document.getElementById('closeSettingsModal').addEventListener('click', () => hideModal('settingsModal'));
    document.getElementById('closeSettingsBtn').addEventListener('click', () => hideModal('settingsModal'));
    
    // 主题切换
    elements.themeSwitcher.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => switchTheme(btn.dataset.theme));
    });
    
    // 存储目录设置
    elements.browseStoragePathBtn.addEventListener('click', browseStoragePath);
    elements.resetStoragePathBtn.addEventListener('click', resetStoragePath);

    // 添加便携应用
    elements.addPortableBtn.addEventListener('click', () => showModal('addPortableModal'));
    elements.browseExeBtn.addEventListener('click', browseExeFile);
    document.getElementById('closeAddPortableModal').addEventListener('click', () => hideModal('addPortableModal'));
    document.getElementById('cancelAddPortable').addEventListener('click', () => hideModal('addPortableModal'));
    document.getElementById('confirmAddPortable').addEventListener('click', addPortableApp);

    // 添加分组弹窗事件
    document.getElementById('closeAddGroupModal').addEventListener('click', () => hideModal('addGroupModal'));
    document.getElementById('cancelAddGroup').addEventListener('click', () => hideModal('addGroupModal'));
    document.getElementById('confirmAddGroup').addEventListener('click', createGroup);

    // 重命名分组弹窗事件
    document.getElementById('closeRenameGroupModal').addEventListener('click', () => hideModal('renameGroupModal'));
    document.getElementById('cancelRenameGroup').addEventListener('click', () => hideModal('renameGroupModal'));
    document.getElementById('confirmRenameGroup').addEventListener('click', renameGroup);

    // 选择分组弹窗事件
    document.getElementById('closeSelectGroupModal').addEventListener('click', () => hideModal('selectGroupModal'));
    document.getElementById('cancelSelectGroup').addEventListener('click', () => hideModal('selectGroupModal'));

    // 点击模态框背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal.id);
            }
        });
    });

    // 回车创建分组
    elements.groupNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createGroup();
        }
    });

    // 回车重命名分组
    elements.renameGroupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            renameGroup();
        }
    });

    // 回车添加便携应用
    elements.portableNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPortableApp();
        }
    });
}

// 浏览选择exe文件
async function browseExeFile() {
    try {
        const result = await window.electronAPI.selectExeFile();
        if (result && result.filePath) {
            elements.portablePathInput.value = result.filePath;

            // 如果名称为空，自动从文件名提取
            if (!elements.portableNameInput.value) {
                const fileName = result.filePath.split('\\').pop().replace('.exe', '');
                elements.portableNameInput.value = fileName;
            }
        }
    } catch (error) {
        showToast('选择文件失败', 'error');
    }
}

// 添加便携应用
async function addPortableApp() {
    const name = elements.portableNameInput.value.trim();
    const path = elements.portablePathInput.value.trim();
    const publisher = elements.portablePublisherInput.value.trim();

    if (!name) {
        showToast('请输入应用名称', 'warning');
        return;
    }

    if (!path) {
        showToast('请选择可执行文件', 'warning');
        return;
    }

    try {
        const result = await window.electronAPI.addPortableApp({
            name,
            path,
            publisher
        });

        if (result.success) {
            // 添加到本地应用列表
            allApps.push(result.app);
            allApps.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

            // 加载图标
            loadAppIcon(result.app);

            // 重新渲染
            renderApps(allApps);
            renderGroups();

            // 清空表单并关闭弹窗
            elements.portableNameInput.value = '';
            elements.portablePathInput.value = '';
            elements.portablePublisherInput.value = '';
            hideModal('addPortableModal');

            showToast(`便携应用"${name}"添加成功`, 'success');
        } else {
            showToast('添加失败: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('添加失败: ' + error.message, 'error');
    }
}

// 加载单个应用图标
async function loadAppIcon(app) {
    if (app.path && app.path.endsWith('.exe') && !appIcons[app.id]) {
        try {
            const icon = await window.electronAPI.getAppIcon(app.path);
            if (icon) {
                appIcons[app.id] = icon;
                // 更新已渲染的卡片图标
                const card = document.querySelector(`.app-card[data-id="${app.id}"]`);
                if (card) {
                    const iconEl = card.querySelector('.app-icon');
                    if (iconEl) {
                        iconEl.innerHTML = `<img src="${icon}" alt="icon" />`;
                    }
                }
            }
        } catch (error) {
            console.error('加载图标失败:', error);
        }
    }
}

// 批量加载应用图标
async function loadAppIcons(apps) {
    const appsWithPath = apps.filter(app => app.path && app.path.endsWith('.exe'));

    // 并行加载图标，但限制并发数
    const batchSize = 10;
    for (let i = 0; i < appsWithPath.length; i += batchSize) {
        const batch = appsWithPath.slice(i, i + batchSize);
        await Promise.all(batch.map(app => loadAppIcon(app)));
    }
}

// 扫描应用
async function scanApps() {
    if (isScanning) return;

    isScanning = true;
    elements.scanBtn.disabled = true;
    elements.loadingState.style.display = 'flex';
    elements.emptyState.style.display = 'none';
    elements.appsGrid.querySelectorAll('.app-card, .apps-section').forEach(el => el.remove());

    try {
        allApps = await window.electronAPI.scanApps();

        // 如果当前在分组视图，扫描后继续显示分组内的应用
        if (currentGroupId) {
            showGroupApps(currentGroupId);
        } else {
            renderApps(allApps);
        }

        // 异步加载图标
        loadAppIcons(allApps);

        showToast(`扫描完成，共发现 ${allApps.length} 个应用`, 'success');
    } catch (error) {
        showToast('扫描失败: ' + error.message, 'error');
        elements.emptyState.style.display = 'flex';
    } finally {
        isScanning = false;
        elements.scanBtn.disabled = false;
        elements.loadingState.style.display = 'none';
    }
}

// 刷新运行状态
async function refreshStatus() {
    if (allApps.length === 0) {
        showToast('请先扫描应用', 'warning');
        return;
    }

    elements.refreshBtn.disabled = true;

    try {
        allApps = await window.electronAPI.refreshRunningStatus(allApps);

        if (currentGroupId) {
            showGroupApps(currentGroupId);
        } else {
            renderApps(allApps);
        }
        showToast('状态已刷新', 'success');
    } catch (error) {
        showToast('刷新失败', 'error');
    } finally {
        elements.refreshBtn.disabled = false;
    }
}

// 渲染应用列表
function renderApps(apps) {
    // 清除之前的应用卡片和分隔区域
    elements.appsGrid.querySelectorAll('.app-card, .apps-section').forEach(el => el.remove());

    if (apps.length === 0) {
        elements.emptyState.style.display = 'flex';
        elements.appCount.textContent = '0 个应用';
        return;
    }

    elements.emptyState.style.display = 'none';

    // 区分可运行和缺少执行文件的应用
    const runnableApps = apps.filter(app => app.path && app.path.endsWith('.exe'));
    const missingPathApps = apps.filter(app => !app.path || !app.path.endsWith('.exe'));

    elements.appCount.textContent = `${apps.length} 个应用 (${runnableApps.length} 可运行, ${missingPathApps.length} 缺少路径)`;

    // 渲染可运行的应用
    if (runnableApps.length > 0) {
        const runnableSection = document.createElement('div');
        runnableSection.className = 'apps-section';
        runnableSection.innerHTML = `
            <div class="section-header">
                <span class="section-icon">✅</span>
                <span class="section-title">可运行的应用</span>
                <span class="section-count">${runnableApps.length} 个</span>
            </div>
            <div class="section-grid"></div>
        `;
        const grid = runnableSection.querySelector('.section-grid');
        runnableApps.forEach(app => {
            const card = createAppCard(app, false);
            grid.appendChild(card);
        });
        elements.appsGrid.appendChild(runnableSection);
    }

    // 渲染缺少执行文件的应用
    if (missingPathApps.length > 0) {
        const missingSection = document.createElement('div');
        missingSection.className = 'apps-section section-missing';
        missingSection.innerHTML = `
            <div class="section-header">
                <span class="section-icon">⚠️</span>
                <span class="section-title">缺少可执行文件</span>
                <span class="section-count">${missingPathApps.length} 个</span>
                <span class="section-hint">可手动指定执行文件路径</span>
            </div>
            <div class="section-grid"></div>
        `;
        const grid = missingSection.querySelector('.section-grid');
        missingPathApps.forEach(app => {
            const card = createAppCard(app, true);
            grid.appendChild(card);
        });
        elements.appsGrid.appendChild(missingSection);
    }
}

// 创建应用卡片
function createAppCard(app, showSetPath = false) {
    const card = document.createElement('div');
    const hasPath = app.path && app.path.endsWith('.exe');
    const isPortable = app.isPortable;
    card.className = `app-card ${selectedApps.has(app.id) ? 'selected' : ''} ${app.isRunning ? 'running' : ''} ${!hasPath ? 'no-exe' : ''} ${isPortable ? 'portable' : ''}`;
    card.dataset.id = app.id;

    const statusClass = app.isRunning ? 'status-running' : 'status-stopped';
    const statusText = app.isRunning ? '运行中' : '未运行';

    // 运行中或缺少路径都禁用启动按钮
    const launchDisabled = !hasPath || app.isRunning;
    let launchTitle = '启动应用';
    if (!hasPath) launchTitle = '无法启动：缺少可执行文件路径';
    else if (app.isRunning) launchTitle = '应用已在运行中';

    // 获取图标
    const iconContent = appIcons[app.id]
        ? `<img src="${appIcons[app.id]}" alt="icon" />`
        : (hasPath ? '📦' : '⚠️');

    // 发布者显示
    let publisherText = app.publisher || '未知发布者';
    if (isPortable) {
        publisherText = `🔷 ${publisherText}`;
    }

    card.innerHTML = `
        <div class="app-checkbox">
            <input type="checkbox" ${selectedApps.has(app.id) ? 'checked' : ''} />
        </div>
        <div class="app-icon">${iconContent}</div>
        <div class="app-info">
            <h3 class="app-name" title="${app.name}">${app.name}</h3>
            <p class="app-publisher" title="${publisherText}">${publisherText}</p>
            <p class="app-path ${!hasPath ? 'path-missing' : ''}" title="${app.path || '路径未知'}">${app.path || '❌ 缺少可执行文件路径'}</p>
        </div>
        <div class="app-actions-wrapper">
            <div class="app-status ${statusClass}">
                <span class="status-dot"></span>
                ${statusText}
            </div>
            ${showSetPath ? `
                <button class="btn-set-path" title="指定可执行文件">
                    指定路径
                </button>
            ` : (app.isRunning ? `
                <button class="btn-stop-single" title="停止应用">
                    ⏹️ 停止
                </button>
            ` : `
                <button class="btn-launch-single" ${!hasPath ? 'disabled' : ''} title="${launchTitle}">
                    ▶️ 启动
                </button>
            `)}
        </div>
        <div class="app-more-menu">
            <button class="btn-app-more" title="更多操作">⋯</button>
            <div class="app-dropdown-menu">
                <div class="app-dropdown-menu-inner">
                    <div class="app-dropdown-item" data-action="open-dir">
                        <span class="app-dropdown-icon">📁</span>
                        <span>打开目录</span>
                    </div>
                    <div class="app-dropdown-item" data-action="set-path">
                        <span class="app-dropdown-icon">📂</span>
                        <span>目录设置</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 更多操作菜单事件
    const moreMenuWrapper = card.querySelector('.app-more-menu');
    const dropdownMenu = card.querySelector('.app-dropdown-menu');

    moreMenuWrapper.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        // 关闭其他已打开的菜单
        document.querySelectorAll('.app-dropdown-menu.show').forEach(menu => {
            if (menu !== dropdownMenu) menu.classList.remove('show');
        });
        
        dropdownMenu.classList.add('show');
    });

    moreMenuWrapper.addEventListener('mouseleave', (e) => {
        const relatedTarget = e.relatedTarget;
        if (!dropdownMenu.contains(relatedTarget)) {
            dropdownMenu.classList.remove('show');
        }
    });

    dropdownMenu.addEventListener('mouseleave', (e) => {
        const relatedTarget = e.relatedTarget;
        if (!moreMenuWrapper.contains(relatedTarget)) {
            dropdownMenu.classList.remove('show');
        }
    });

    // 打开目录操作
    const openDirItem = card.querySelector('[data-action="open-dir"]');
    openDirItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        dropdownMenu.classList.remove('show');
        await openAppDirectory(app);
    });

    // 目录设置操作
    const setPathItem = card.querySelector('[data-action="set-path"]');
    setPathItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        dropdownMenu.classList.remove('show');
        await setAppPath(app);
    });

    // 选择复选框事件
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        toggleAppSelection(app.id);
    });

    // 点击卡片切换选择
    card.addEventListener('click', (e) => {
        if (!e.target.matches('button') && !e.target.matches('input') && !e.target.closest('.app-more-menu')) {
            toggleAppSelection(app.id);
            checkbox.checked = selectedApps.has(app.id);
        }
    });

    // 启动按钮事件
    const launchBtn = card.querySelector('.btn-launch-single');
    if (launchBtn) {
        launchBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await launchSingleApp(app);
        });
    }

    // 停止按钮事件
    const stopBtn = card.querySelector('.btn-stop-single');
    if (stopBtn) {
        stopBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await stopSingleApp(app);
        });
    }

    // 指定路径按钮事件（缺少路径时显示的按钮）
    const setPathBtn = card.querySelector('.btn-set-path');
    if (setPathBtn) {
        setPathBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await setAppPath(app);
        });
    }

    return card;
}

// 停止单个应用
async function stopSingleApp(app) {
    if (!app.path) {
        showToast('无法停止：缺少可执行文件路径', 'error');
        return;
    }

    // 弹出确认框
    if (!confirm(`确定要停止"${app.name}"吗？\n\n注意：强制停止可能导致未保存的数据丢失。`)) {
        return;
    }

    try {
        const result = await window.electronAPI.stopApp(app.path);
        if (result.success) {
            showToast(`${app.name} 已停止`, 'success');
            // 延迟刷新状态
            setTimeout(refreshStatus, 500);
        } else {
            showToast(`停止失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast(`停止失败: ${error.message}`, 'error');
    }
}

// 打开应用所在目录
async function openAppDirectory(app) {
    if (!app.path) {
        showToast('该应用没有设置可执行文件路径', 'warning');
        return;
    }

    try {
        const result = await window.electronAPI.openDirectory(app.path);
        if (!result.success) {
            showToast('无法打开目录: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('打开目录失败: ' + error.message, 'error');
    }
}

// 切换应用选择
function toggleAppSelection(appId) {
    if (selectedApps.has(appId)) {
        selectedApps.delete(appId);
    } else {
        selectedApps.add(appId);
    }
    updateSelectionUI();
}

// 更新选择状态 UI
function updateSelectionUI() {
    elements.selectedCount.textContent = selectedApps.size;

    if (currentGroupId) {
        elements.actionBar.style.display = 'none';
        elements.groupActionBar.style.display = 'flex';
        // 未选中时禁用移除按钮
        elements.removeFromGroupBtn.disabled = selectedApps.size === 0;
    } else {
        elements.actionBar.style.display = selectedApps.size > 0 ? 'flex' : 'none';
        elements.groupActionBar.style.display = 'none';
    }

    // 更新卡片样式
    document.querySelectorAll('.app-card').forEach(card => {
        const isSelected = selectedApps.has(card.dataset.id);
        card.classList.toggle('selected', isSelected);
        card.querySelector('input[type="checkbox"]').checked = isSelected;
    });
}

// 清除选择
function clearSelection() {
    selectedApps.clear();
    updateSelectionUI();
}

// 设置应用路径
async function setAppPath(app) {
    try {
        const result = await window.electronAPI.selectExeFile();
        if (result && result.filePath) {
            // 更新应用路径
            app.path = result.filePath;

            // 更新 allApps 中的应用
            const appIndex = allApps.findIndex(a => a.id === app.id);
            if (appIndex !== -1) {
                allApps[appIndex].path = result.filePath;
            }

            // 保存自定义路径
            await window.electronAPI.saveCustomPath(app.id, result.filePath);

            // 加载图标
            loadAppIcon(app);

            // 重新渲染
            if (currentGroupId) {
                showGroupApps(currentGroupId);
            } else {
                renderApps(allApps);
            }

            showToast(`已为 ${app.name} 设置执行文件路径`, 'success');
        }
    } catch (error) {
        showToast('设置路径失败: ' + error.message, 'error');
    }
}

// 启动单个应用
async function launchSingleApp(app) {
    if (!app.path || !app.path.endsWith('.exe')) {
        showToast('无法启动：缺少可执行文件路径', 'error');
        return;
    }

    // 先检查是否已运行
    const isRunning = await window.electronAPI.checkRunning(app.path);
    if (isRunning) {
        showToast(`${app.name} 已在运行中`, 'info');
        return;
    }

    try {
        const result = await window.electronAPI.launchApp(app.path);
        if (result.success) {
            showToast(`${app.name} 已启动`, 'success');
            // 延迟刷新状态
            setTimeout(refreshStatus, 1000);
        } else {
            showToast(`启动失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast(`启动失败: ${error.message}`, 'error');
    }
}

// 加载分组
async function loadGroups() {
    groups = await window.electronAPI.getGroups();
}

// 保存分组
async function saveGroupsToStorage() {
    await window.electronAPI.saveGroups(groups);
}

// 渲染分组列表
function renderGroups() {
    elements.groupsList.innerHTML = '';

    // 添加"所有应用"选项
    const allAppsItem = document.createElement('div');
    allAppsItem.className = `group-item ${currentGroupId === null ? 'active' : ''}`;
    allAppsItem.innerHTML = `
        <span class="group-icon">🖥️</span>
        <span class="group-name">所有应用</span>
    `;
    allAppsItem.addEventListener('click', () => {
        currentGroupId = null;
        elements.currentView.textContent = '🖥️ 所有应用';
        clearSelection();
        renderApps(allApps);
        renderGroups();
        elements.groupActionBar.style.display = 'none';
    });
    elements.groupsList.appendChild(allAppsItem);

    // 渲染分组
    groups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = `group-item ${currentGroupId === group.id ? 'active' : ''}`;
        groupItem.innerHTML = `
            <span class="group-icon">📁</span>
            <span class="group-name">${group.name}</span>
            <div class="group-menu-wrapper">
                <button class="btn-group-menu" title="更多操作">⋯</button>
                <div class="group-dropdown-menu">
                    <div class="dropdown-item dropdown-rename" data-action="rename">
                        <span class="dropdown-icon">✏️</span>
                        <span>重命名</span>
                    </div>
                    <div class="dropdown-item dropdown-delete" data-action="delete">
                        <span class="dropdown-icon">🗑️</span>
                        <span>删除分组</span>
                    </div>
                </div>
            </div>
        `;

        groupItem.addEventListener('click', (e) => {
            if (!e.target.closest('.group-menu-wrapper')) {
                showGroupApps(group.id);
            }
        });

        // 三点菜单按钮事件
        const menuBtn = groupItem.querySelector('.btn-group-menu');
        const dropdownMenu = groupItem.querySelector('.group-dropdown-menu');
        
        // 鼠标悬停显示菜单
        const menuWrapper = groupItem.querySelector('.group-menu-wrapper');
        
        menuWrapper.addEventListener('mouseenter', (e) => {
            // 关闭其他已打开的菜单
            document.querySelectorAll('.group-dropdown-menu.show').forEach(menu => {
                if (menu !== dropdownMenu) menu.classList.remove('show');
            });
            
            // 计算菜单位置（fixed 定位）
            const rect = menuBtn.getBoundingClientRect();
            dropdownMenu.style.top = `${rect.bottom + 4}px`;
            dropdownMenu.style.left = `${rect.left}px`;
            
            dropdownMenu.classList.add('show');
        });
        
        menuWrapper.addEventListener('mouseleave', (e) => {
            // 检查鼠标是否移到了下拉菜单上
            const relatedTarget = e.relatedTarget;
            if (!dropdownMenu.contains(relatedTarget)) {
                dropdownMenu.classList.remove('show');
            }
        });
        
        dropdownMenu.addEventListener('mouseleave', (e) => {
            const relatedTarget = e.relatedTarget;
            if (!menuWrapper.contains(relatedTarget)) {
                dropdownMenu.classList.remove('show');
            }
        });

        // 重命名操作
        const renameItem = groupItem.querySelector('.dropdown-rename');
        renameItem.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.remove('show');
            openRenameGroupModal(group);
        });

        // 删除操作
        const deleteItem = groupItem.querySelector('.dropdown-delete');
        deleteItem.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.remove('show');
            deleteGroup(group.id);
        });

        elements.groupsList.appendChild(groupItem);
    });

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', closeAllGroupMenus);

    // 更新选择分组弹窗
    renderGroupSelectList();
}

// 渲染分组选择列表
function renderGroupSelectList() {
    elements.groupSelectList.innerHTML = '';

    if (groups.length === 0) {
        elements.groupSelectList.innerHTML = '<p class="no-groups">暂无分组，请先创建分组</p>';
        return;
    }

    groups.forEach(group => {
        const item = document.createElement('div');
        item.className = 'group-select-item';
        item.innerHTML = `
            <span class="group-icon">📁</span>
            <span class="group-name">${group.name}</span>
            <span class="group-count">${group.apps.length} 个应用</span>
        `;
        item.addEventListener('click', () => addSelectedToGroup(group.id));
        elements.groupSelectList.appendChild(item);
    });
}

// 显示分组下的应用
function showGroupApps(groupId) {
    currentGroupId = groupId;
    const group = groups.find(g => g.id === groupId);

    if (!group) return;

    elements.currentView.textContent = `📁 ${group.name}`;
    clearSelection();
    renderGroups();

    // 获取分组中的应用
    const groupApps = group.apps.map(appId => allApps.find(a => a.id === appId)).filter(Boolean);
    renderApps(groupApps);

    elements.groupActionBar.style.display = 'flex';
}

// 创建分组
async function createGroup() {
    const name = elements.groupNameInput.value.trim();

    if (!name) {
        showToast('请输入分组名称', 'warning');
        return;
    }

    if (groups.some(g => g.name === name)) {
        showToast('分组名称已存在', 'warning');
        return;
    }

    const newGroup = {
        id: Date.now().toString(),
        name: name,
        apps: []
    };

    groups.push(newGroup);
    await saveGroupsToStorage();
    renderGroups();
    hideModal('addGroupModal');
    elements.groupNameInput.value = '';
    showToast(`分组"${name}"创建成功`, 'success');
}

// 关闭所有分组下拉菜单
function closeAllGroupMenus(e) {
    if (!e.target.closest('.group-menu-wrapper')) {
        document.querySelectorAll('.group-dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
    }
    // 同时关闭应用卡片的下拉菜单
    if (!e.target.closest('.app-more-menu')) {
        document.querySelectorAll('.app-dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
    }
}

// 打开重命名分组弹窗
function openRenameGroupModal(group) {
    elements.renameGroupInput.value = group.name;
    elements.renameGroupInput.dataset.groupId = group.id;
    showModal('renameGroupModal');
}

// 重命名分组
async function renameGroup() {
    const groupId = elements.renameGroupInput.dataset.groupId;
    const newName = elements.renameGroupInput.value.trim();

    if (!newName) {
        showToast('请输入分组名称', 'warning');
        return;
    }

    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // 检查名称是否与其他分组重复
    if (groups.some(g => g.id !== groupId && g.name === newName)) {
        showToast('分组名称已存在', 'warning');
        return;
    }

    const oldName = group.name;
    group.name = newName;
    await saveGroupsToStorage();
    renderGroups();
    hideModal('renameGroupModal');

    // 如果当前正在查看被重命名的分组，更新标题
    if (currentGroupId === groupId) {
        elements.currentView.textContent = `📁 ${newName}`;
    }

    showToast(`分组"${oldName}"已重命名为"${newName}"`, 'success');
}

// 删除分组
async function deleteGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (confirm(`确定要删除分组"${group.name}"吗？`)) {
        groups = groups.filter(g => g.id !== groupId);
        await saveGroupsToStorage();

        if (currentGroupId === groupId) {
            currentGroupId = null;
            elements.currentView.textContent = '🖥️ 所有应用';
            renderApps(allApps);
            elements.groupActionBar.style.display = 'none';
        }

        renderGroups();
        showToast(`分组"${group.name}"已删除`, 'success');
    }
}

// 将选中的应用添加到分组
async function addSelectedToGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    let addedCount = 0;
    selectedApps.forEach(appId => {
        if (!group.apps.includes(appId)) {
            group.apps.push(appId);
            addedCount++;
        }
    });

    await saveGroupsToStorage();
    renderGroups();
    hideModal('selectGroupModal');
    clearSelection();

    showToast(`已将 ${addedCount} 个应用添加到"${group.name}"`, 'success');
}

// 从分组移除选中的应用
async function removeFromGroup() {
    if (!currentGroupId) return;

    const group = groups.find(g => g.id === currentGroupId);
    if (!group) return;

    const removeCount = selectedApps.size;
    group.apps = group.apps.filter(appId => !selectedApps.has(appId));

    await saveGroupsToStorage();
    clearSelection();
    showGroupApps(currentGroupId);

    showToast(`已从分组移除 ${removeCount} 个应用`, 'success');
}

// 快速启动分组
async function quickLaunchGroup() {
    if (!currentGroupId) return;

    const group = groups.find(g => g.id === currentGroupId);
    if (!group || group.apps.length === 0) {
        showToast('分组中没有应用', 'warning');
        return;
    }

    elements.quickLaunchBtn.disabled = true;
    let launchedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const appId of group.apps) {
        const app = allApps.find(a => a.id === appId);
        if (!app || !app.path || !app.path.endsWith('.exe')) {
            failedCount++;
            continue;
        }

        // 检查是否已运行
        const isRunning = await window.electronAPI.checkRunning(app.path);
        if (isRunning) {
            skippedCount++;
            continue;
        }

        try {
            const result = await window.electronAPI.launchApp(app.path);
            if (result.success) {
                launchedCount++;
            } else {
                failedCount++;
            }
        } catch (error) {
            failedCount++;
        }

        // 短暂延迟避免同时启动太多程序
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    elements.quickLaunchBtn.disabled = false;

    let message = `启动完成：${launchedCount} 个成功`;
    if (skippedCount > 0) message += `，${skippedCount} 个已运行跳过`;
    if (failedCount > 0) message += `，${failedCount} 个失败`;

    showToast(message, launchedCount > 0 ? 'success' : 'warning');

    // 延迟刷新状态
    setTimeout(refreshStatus, 2000);
}

// 搜索处理
function handleSearch() {
    const keyword = elements.searchInput.value.toLowerCase().trim();

    let appsToFilter = allApps;
    if (currentGroupId) {
        const group = groups.find(g => g.id === currentGroupId);
        if (group) {
            appsToFilter = group.apps.map(appId => allApps.find(a => a.id === appId)).filter(Boolean);
        }
    }

    if (!keyword) {
        renderApps(appsToFilter);
        return;
    }

    const filtered = appsToFilter.filter(app =>
        app.name.toLowerCase().includes(keyword) ||
        (app.publisher && app.publisher.toLowerCase().includes(keyword))
    );

    renderApps(filtered);
}

// 显示弹窗
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');

    if (modalId === 'addGroupModal') {
        elements.groupNameInput.focus();
    } else if (modalId === 'addPortableModal') {
        elements.portableNameInput.focus();
    } else if (modalId === 'renameGroupModal') {
        elements.renameGroupInput.focus();
        elements.renameGroupInput.select();
    }
}

// 隐藏弹窗
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
}

// Toast 通知
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    // 动画进入
    setTimeout(() => toast.classList.add('show'), 10);

    // 自动消失
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 启动初始化
init();
