import { elements } from './state.js';
import { loadSettings, initSettingsEvents } from './settings.js';
import {
    loadGroups,
    renderGroups,
    createGroup,
    renameGroup,
    quickLaunchGroup,
    removeFromGroup
} from './groups.js';
import {
    bindAppEvents,
    registerGroupProxies,
    initAppData
} from './apps.js';
import { showModal, hideModal, closeAllMenus } from './ui.js';

async function init() {
    await loadSettings();
    await loadGroups();
    renderGroups();
    initSettingsEvents();
    bindAppEvents();

    // 分组弹窗事件
    elements.addGroupBtn.addEventListener('click', () => showModal('addGroupModal'));
    document.getElementById('closeAddGroupModal').addEventListener('click', () => hideModal('addGroupModal'));
    document.getElementById('cancelAddGroup').addEventListener('click', () => hideModal('addGroupModal'));
    document.getElementById('confirmAddGroup').addEventListener('click', () => createGroup());
    document.getElementById('closeRenameGroupModal').addEventListener('click', () => hideModal('renameGroupModal'));
    document.getElementById('cancelRenameGroup').addEventListener('click', () => hideModal('renameGroupModal'));
    document.getElementById('confirmRenameGroup').addEventListener('click', () => renameGroup());
    document.getElementById('closeSelectGroupModal').addEventListener('click', () => hideModal('selectGroupModal'));
    document.getElementById('cancelSelectGroup').addEventListener('click', () => hideModal('selectGroupModal'));

    // 点击模态背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModal(modal.id);
        });
    });

    document.addEventListener('click', closeAllMenus);

    registerGroupProxies({
        createGroup,
        renameGroup,
        quickLaunchGroup,
        removeFromGroup
    });

    initAppData();
}

init();

