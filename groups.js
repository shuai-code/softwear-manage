import { state, elements } from './state.js';
import { showModal, hideModal, showToast } from './ui.js';
import { renderApps, showGroupApps } from './apps.js';

export async function loadGroups() {
    state.groups = await window.electronAPI.getGroups();
}

async function saveGroupsToStorage() {
    await window.electronAPI.saveGroups(state.groups);
}

export function renderGroupSelectList() {
    elements.groupSelectList.innerHTML = '';

    if (state.groups.length === 0) {
        elements.groupSelectList.innerHTML = '<p class="no-groups">暂无分组，请先创建分组</p>';
        return;
    }

    state.groups.forEach(group => {
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

export function renderGroups() {
    elements.groupsList.innerHTML = '';

    const allAppsItem = document.createElement('div');
    allAppsItem.className = `group-item ${state.currentGroupId === null ? 'active' : ''}`;
    allAppsItem.innerHTML = `
        <span class="group-icon">🖥️</span>
        <span class="group-name">所有应用</span>
    `;
    allAppsItem.addEventListener('click', () => {
        state.currentGroupId = null;
        elements.currentView.textContent = '🖥️ 所有应用';
        state.selectedApps.clear();
        renderApps(state.allApps);
        renderGroups();
        elements.groupActionBar.style.display = 'none';
    });
    elements.groupsList.appendChild(allAppsItem);

    state.groups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = `group-item ${state.currentGroupId === group.id ? 'active' : ''}`;
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

        const menuBtn = groupItem.querySelector('.btn-group-menu');
        const dropdownMenu = groupItem.querySelector('.group-dropdown-menu');
        const menuWrapper = groupItem.querySelector('.group-menu-wrapper');

        menuWrapper.addEventListener('mouseenter', () => {
            document.querySelectorAll('.group-dropdown-menu.show').forEach(menu => {
                if (menu !== dropdownMenu) menu.classList.remove('show');
            });

            const rect = menuBtn.getBoundingClientRect();
            dropdownMenu.style.top = `${rect.bottom + 4}px`;
            dropdownMenu.style.left = `${rect.left}px`;
            dropdownMenu.classList.add('show');
        });

        menuWrapper.addEventListener('mouseleave', (e) => {
            const relatedTarget = e.relatedTarget;
            if (!dropdownMenu.contains(relatedTarget)) dropdownMenu.classList.remove('show');
        });

        dropdownMenu.addEventListener('mouseleave', (e) => {
            const relatedTarget = e.relatedTarget;
            if (!menuWrapper.contains(relatedTarget)) dropdownMenu.classList.remove('show');
        });

        const renameItem = groupItem.querySelector('.dropdown-rename');
        renameItem.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.remove('show');
            openRenameGroupModal(group);
        });

        const deleteItem = groupItem.querySelector('.dropdown-delete');
        deleteItem.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.remove('show');
            deleteGroup(group.id);
        });

        elements.groupsList.appendChild(groupItem);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.group-menu-wrapper')) {
            document.querySelectorAll('.group-dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
        }
    });

    renderGroupSelectList();
}

export async function createGroup() {
    const name = elements.groupNameInput.value.trim();
    if (!name) {
        showToast('请输入分组名称', 'warning');
        return;
    }
    if (state.groups.some(g => g.name === name)) {
        showToast('分组名称已存在', 'warning');
        return;
    }

    const newGroup = { id: Date.now().toString(), name, apps: [] };
    state.groups.push(newGroup);
    await saveGroupsToStorage();
    renderGroups();
    hideModal('addGroupModal');
    elements.groupNameInput.value = '';
    showToast(`分组"${name}"创建成功`, 'success');
}

export function openRenameGroupModal(group) {
    elements.renameGroupInput.value = group.name;
    elements.renameGroupInput.dataset.groupId = group.id;
    showModal('renameGroupModal');
}

export async function renameGroup() {
    const groupId = elements.renameGroupInput.dataset.groupId;
    const newName = elements.renameGroupInput.value.trim();
    if (!newName) {
        showToast('请输入分组名称', 'warning');
        return;
    }

    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;

    if (state.groups.some(g => g.id !== groupId && g.name === newName)) {
        showToast('分组名称已存在', 'warning');
        return;
    }

    const oldName = group.name;
    group.name = newName;
    await saveGroupsToStorage();
    renderGroups();
    hideModal('renameGroupModal');

    if (state.currentGroupId === groupId) {
        elements.currentView.textContent = `📁 ${newName}`;
    }

    showToast(`分组"${oldName}"已重命名为"${newName}"`, 'success');
}

export async function deleteGroup(groupId) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;
    if (confirm(`确定要删除分组"${group.name}"吗？`)) {
        state.groups = state.groups.filter(g => g.id !== groupId);
        await saveGroupsToStorage();
        if (state.currentGroupId === groupId) {
            state.currentGroupId = null;
            elements.currentView.textContent = '🖥️ 所有应用';
            renderApps(state.allApps);
            elements.groupActionBar.style.display = 'none';
        }
        renderGroups();
        showToast(`分组"${group.name}"已删除`, 'success');
    }
}

export async function addSelectedToGroup(groupId) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;
    let addedCount = 0;
    state.selectedApps.forEach(appId => {
        if (!group.apps.includes(appId)) {
            group.apps.push(appId);
            addedCount++;
        }
    });
    await saveGroupsToStorage();
    renderGroups();
    hideModal('selectGroupModal');
    state.selectedApps.clear();
    showToast(`已将 ${addedCount} 个应用添加到"${group.name}"`, 'success');
}

export async function removeFromGroup() {
    if (!state.currentGroupId) return;
    const group = state.groups.find(g => g.id === state.currentGroupId);
    if (!group) return;

    const removeCount = state.selectedApps.size;
    group.apps = group.apps.filter(appId => !state.selectedApps.has(appId));
    await saveGroupsToStorage();
    state.selectedApps.clear();
    showGroupApps(state.currentGroupId);
    showToast(`已从分组移除 ${removeCount} 个应用`, 'success');
}

export async function quickLaunchGroup() {
    if (!state.currentGroupId) return;
    const group = state.groups.find(g => g.id === state.currentGroupId);
    if (!group || group.apps.length === 0) {
        showToast('分组中没有应用', 'warning');
        return;
    }

    elements.quickLaunchBtn.disabled = true;
    let launchedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const appId of group.apps) {
        const app = state.allApps.find(a => a.id === appId);
        if (!app || !app.path || !app.path.endsWith('.exe')) {
            failedCount++;
            continue;
        }
        const isRunning = await window.electronAPI.checkRunning(app.path);
        if (isRunning) {
            skippedCount++;
            continue;
        }
        try {
            const result = await window.electronAPI.launchApp(app.path);
            if (result.success) launchedCount++;
            else failedCount++;
        } catch {
            failedCount++;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    elements.quickLaunchBtn.disabled = false;
    let message = `启动完成：${launchedCount} 个成功`;
    if (skippedCount > 0) message += `，${skippedCount} 个已运行跳过`;
    if (failedCount > 0) message += `，${failedCount} 个失败`;
    showToast(message, launchedCount > 0 ? 'success' : 'warning');
    setTimeout(() => window.dispatchEvent(new CustomEvent('refresh-status')), 2000);
}

