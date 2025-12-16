import { state, elements } from './state.js';
import { showModal, showToast, updateSelectionUI, clearSelection } from './ui.js';
import { renderGroups, renderGroupSelectList } from './groups.js';

// 加载单个应用图标
async function loadAppIcon(app) {
    if (app.path && app.path.endsWith('.exe') && !state.appIcons[app.id]) {
        try {
            const icon = await window.electronAPI.getAppIcon(app.path);
            if (icon) {
                state.appIcons[app.id] = icon;
                const card = document.querySelector(`.app-card[data-id="${app.id}"]`);
                if (card) {
                    const iconEl = card.querySelector('.app-icon');
                    if (iconEl) iconEl.innerHTML = `<img src="${icon}" alt="icon" />`;
                }
            }
        } catch (error) {
            console.error('加载图标失败:', error);
        }
    }
}

// 批量加载图标
async function loadAppIcons(apps) {
    const appsWithPath = apps.filter(app => app.path && app.path.endsWith('.exe'));
    const batchSize = 10;
    for (let i = 0; i < appsWithPath.length; i += batchSize) {
        const batch = appsWithPath.slice(i, i + batchSize);
        await Promise.all(batch.map(app => loadAppIcon(app)));
    }
}

export async function scanApps() {
    if (state.isScanning) return;
    state.isScanning = true;
    elements.scanBtn.disabled = true;
    elements.loadingState.style.display = 'flex';
    elements.emptyState.style.display = 'none';
    elements.appsGrid.querySelectorAll('.app-card, .apps-section').forEach(el => el.remove());

    try {
        state.allApps = await window.electronAPI.scanApps();
        if (state.currentGroupId) {
            showGroupApps(state.currentGroupId);
        } else {
            renderApps(state.allApps);
        }
        loadAppIcons(state.allApps);
        showToast(`扫描完成，共发现 ${state.allApps.length} 个应用`, 'success');
    } catch (error) {
        showToast('扫描失败: ' + error.message, 'error');
        elements.emptyState.style.display = 'flex';
    } finally {
        state.isScanning = false;
        elements.scanBtn.disabled = false;
        elements.loadingState.style.display = 'none';
    }
}

export async function refreshStatus() {
    if (state.allApps.length === 0) {
        showToast('请先扫描应用', 'warning');
        return;
    }
    elements.refreshBtn.disabled = true;
    try {
        state.allApps = await window.electronAPI.refreshRunningStatus(state.allApps);
        if (state.currentGroupId) showGroupApps(state.currentGroupId);
        else renderApps(state.allApps);
        showToast('状态已刷新', 'success');
    } catch (error) {
        showToast('刷新失败', 'error');
    } finally {
        elements.refreshBtn.disabled = false;
    }
}

export function renderApps(apps) {
    elements.appsGrid.querySelectorAll('.app-card, .apps-section').forEach(el => el.remove());
    if (apps.length === 0) {
        elements.emptyState.style.display = 'flex';
        elements.appCount.textContent = '0 个应用';
        return;
    }
    elements.emptyState.style.display = 'none';
    const runnableApps = apps.filter(app => app.path && app.path.endsWith('.exe'));
    const missingPathApps = apps.filter(app => !app.path || !app.path.endsWith('.exe'));
    elements.appCount.textContent = `${apps.length} 个应用 (${runnableApps.length} 可运行, ${missingPathApps.length} 缺少路径)`;

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
        runnableApps.forEach(app => grid.appendChild(createAppCard(app, false)));
        elements.appsGrid.appendChild(runnableSection);
    }

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
        missingPathApps.forEach(app => grid.appendChild(createAppCard(app, true)));
        elements.appsGrid.appendChild(missingSection);
    }
}

function createAppCard(app, showSetPath = false) {
    const card = document.createElement('div');
    const hasPath = app.path && app.path.endsWith('.exe');
    const isPortable = app.isPortable;
    card.className = `app-card ${state.selectedApps.has(app.id) ? 'selected' : ''} ${app.isRunning ? 'running' : ''} ${!hasPath ? 'no-exe' : ''} ${isPortable ? 'portable' : ''}`;
    card.dataset.id = app.id;

    const statusClass = app.isRunning ? 'status-running' : 'status-stopped';
    const statusText = app.isRunning ? '运行中' : '未运行';
    let launchTitle = '启动应用';
    if (!hasPath) launchTitle = '无法启动：缺少可执行文件路径';
    else if (app.isRunning) launchTitle = '应用已在运行中';

    const iconContent = state.appIcons[app.id]
        ? `<img src="${state.appIcons[app.id]}" alt="icon" />`
        : (hasPath ? '📦' : '⚠️');

    let publisherText = app.publisher || '未知发布者';
    if (isPortable) publisherText = `🔷 ${publisherText}`;

    card.innerHTML = `
        <div class="app-checkbox">
            <input type="checkbox" ${state.selectedApps.has(app.id) ? 'checked' : ''} />
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

    const moreMenuWrapper = card.querySelector('.app-more-menu');
    const dropdownMenu = card.querySelector('.app-dropdown-menu');
    moreMenuWrapper.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.app-dropdown-menu.show').forEach(menu => {
            if (menu !== dropdownMenu) menu.classList.remove('show');
        });
        dropdownMenu.classList.add('show');
    });
    moreMenuWrapper.addEventListener('mouseleave', (e) => {
        const relatedTarget = e.relatedTarget;
        if (!dropdownMenu.contains(relatedTarget)) dropdownMenu.classList.remove('show');
    });
    dropdownMenu.addEventListener('mouseleave', (e) => {
        const relatedTarget = e.relatedTarget;
        if (!moreMenuWrapper.contains(relatedTarget)) dropdownMenu.classList.remove('show');
    });

    const openDirItem = card.querySelector('[data-action="open-dir"]');
    openDirItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        dropdownMenu.classList.remove('show');
        await openAppDirectory(app);
    });

    const setPathItem = card.querySelector('[data-action="set-path"]');
    setPathItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        dropdownMenu.classList.remove('show');
        await setAppPath(app);
    });

    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        toggleAppSelection(app.id);
    });

    card.addEventListener('click', (e) => {
        if (!e.target.matches('button') && !e.target.matches('input') && !e.target.closest('.app-more-menu')) {
            toggleAppSelection(app.id);
            checkbox.checked = state.selectedApps.has(app.id);
        }
    });

    const launchBtn = card.querySelector('.btn-launch-single');
    if (launchBtn) {
        launchBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await launchSingleApp(app);
        });
    }

    const stopBtn = card.querySelector('.btn-stop-single');
    if (stopBtn) {
        stopBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await stopSingleApp(app);
        });
    }

    const setPathBtn = card.querySelector('.btn-set-path');
    if (setPathBtn) {
        setPathBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await setAppPath(app);
        });
    }

    return card;
}

function toggleAppSelection(appId) {
    if (state.selectedApps.has(appId)) state.selectedApps.delete(appId);
    else state.selectedApps.add(appId);
    updateSelectionUI();
}

export function showGroupApps(groupId) {
    state.currentGroupId = groupId;
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;
    elements.currentView.textContent = `📁 ${group.name}`;
    clearSelection();
    renderGroups();
    const groupApps = group.apps.map(appId => state.allApps.find(a => a.id === appId)).filter(Boolean);
    renderApps(groupApps);
    elements.groupActionBar.style.display = 'flex';
}

async function openAppDirectory(app) {
    if (!app.path) {
        showToast('该应用没有设置可执行文件路径', 'warning');
        return;
    }
    try {
        const result = await window.electronAPI.openDirectory(app.path);
        if (!result.success) showToast('无法打开目录: ' + result.error, 'error');
    } catch (error) {
        showToast('打开目录失败: ' + error.message, 'error');
    }
}

export async function setAppPath(app) {
    try {
        const result = await window.electronAPI.selectExeFile();
        if (result && result.filePath) {
            app.path = result.filePath;
            const idx = state.allApps.findIndex(a => a.id === app.id);
            if (idx !== -1) state.allApps[idx].path = result.filePath;
            await window.electronAPI.saveCustomPath(app.id, result.filePath);
            loadAppIcon(app);
            if (state.currentGroupId) showGroupApps(state.currentGroupId);
            else renderApps(state.allApps);
            showToast(`已为 ${app.name} 设置执行文件路径`, 'success');
        }
    } catch (error) {
        showToast('设置路径失败: ' + error.message, 'error');
    }
}

export async function launchSingleApp(app) {
    if (!app.path || !app.path.endsWith('.exe')) {
        showToast('无法启动：缺少可执行文件路径', 'error');
        return;
    }
    const isRunning = await window.electronAPI.checkRunning(app.path);
    if (isRunning) {
        showToast(`${app.name} 已在运行中`, 'info');
        return;
    }
    try {
        const result = await window.electronAPI.launchApp(app.path);
        if (result.success) {
            showToast(`${app.name} 已启动`, 'success');
            setTimeout(() => window.dispatchEvent(new CustomEvent('refresh-status')), 1000);
        } else {
            showToast(`启动失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast(`启动失败: ${error.message}`, 'error');
    }
}

export async function stopSingleApp(app) {
    if (!app.path) {
        showToast('无法停止：缺少可执行文件路径', 'error');
        return;
    }
    if (!confirm(`确定要停止"${app.name}"吗？\n\n注意：强制停止可能导致未保存的数据丢失。`)) return;
    try {
        const result = await window.electronAPI.stopApp(app.path);
        if (result.success) {
            showToast(`${app.name} 已停止`, 'success');
            setTimeout(() => window.dispatchEvent(new CustomEvent('refresh-status')), 500);
        } else {
            showToast(`停止失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast(`停止失败: ${error.message}`, 'error');
    }
}

export function handleSearch() {
    const keyword = elements.searchInput.value.toLowerCase().trim();
    let appsToFilter = state.allApps;
    if (state.currentGroupId) {
        const group = state.groups.find(g => g.id === state.currentGroupId);
        if (group) appsToFilter = group.apps.map(appId => state.allApps.find(a => a.id === appId)).filter(Boolean);
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

export async function browseExeFile() {
    try {
        const result = await window.electronAPI.selectExeFile();
        if (result && result.filePath) {
            elements.portablePathInput.value = result.filePath;
            if (!elements.portableNameInput.value) {
                const fileName = result.filePath.split('\\').pop().replace('.exe', '');
                elements.portableNameInput.value = fileName;
            }
        }
    } catch (error) {
        showToast('选择文件失败', 'error');
    }
}

export async function addPortableApp() {
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
        const result = await window.electronAPI.addPortableApp({ name, path, publisher });
        if (result.success) {
            state.allApps.push(result.app);
            state.allApps.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
            loadAppIcon(result.app);
            renderApps(state.allApps);
            renderGroups();
            elements.portableNameInput.value = '';
            elements.portablePathInput.value = '';
            elements.portablePublisherInput.value = '';
            hidePortableModal();
            showToast(`便携应用"${name}"添加成功`, 'success');
        } else {
            showToast('添加失败: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('添加失败: ' + error.message, 'error');
    }
}

function hidePortableModal() {
    document.getElementById('addPortableModal').classList.remove('show');
}

export function bindAppEvents() {
    elements.scanBtn.addEventListener('click', scanApps);
    elements.refreshBtn.addEventListener('click', refreshStatus);
    elements.searchInput.addEventListener('input', handleSearch);
    elements.addPortableBtn.addEventListener('click', () => showModal('addPortableModal'));
    elements.browseExeBtn.addEventListener('click', browseExeFile);
    document.getElementById('closeAddPortableModal').addEventListener('click', () => hidePortableModal());
    document.getElementById('cancelAddPortable').addEventListener('click', () => hidePortableModal());
    document.getElementById('confirmAddPortable').addEventListener('click', addPortableApp);

    elements.addToGroupBtn.addEventListener('click', () => showModal('selectGroupModal'));
    elements.cancelSelectBtn.addEventListener('click', clearSelection);
    elements.quickLaunchBtn.addEventListener('click', () => quickLaunchGroupProxy());
    elements.removeFromGroupBtn.addEventListener('click', () => removeFromGroupProxy());

    elements.groupNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createGroupProxy();
    });
    elements.renameGroupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') renameGroupProxy();
    });
    elements.portableNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addPortableApp();
    });

    window.addEventListener('refresh-status', refreshStatus);
}

// 以下代理函数在 renderer.js 中注入，以避免循环依赖
let createGroupProxy = () => {};
let renameGroupProxy = () => {};
let quickLaunchGroupProxy = () => {};
let removeFromGroupProxy = () => {};

export function registerGroupProxies({ createGroup, renameGroup, quickLaunchGroup, removeFromGroup }) {
    createGroupProxy = createGroup;
    renameGroupProxy = renameGroup;
    quickLaunchGroupProxy = quickLaunchGroup;
    removeFromGroupProxy = removeFromGroup;
}

export async function initAppData() {
    // 初始显示空状态
    elements.loadingState.style.display = 'none';
    elements.emptyState.style.display = 'flex';
    renderGroupSelectList();
}

