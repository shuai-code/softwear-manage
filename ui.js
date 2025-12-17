import { state, elements } from './state.js';

export function showModal(modalId) {
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

export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
}

export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function updateSelectionUI() {
    const selectedCount = state.selectedApps.size;
    elements.selectedCount.textContent = selectedCount;

    if (state.currentGroupId) {
        // 在分组视图：不展示“已选择”栏，仅显示分组操作栏
        elements.actionBar.style.display = 'none';
        elements.groupActionBar.style.display = 'flex';
        elements.removeFromGroupBtn.disabled = selectedCount === 0;
    } else {
        // 在所有应用视图：显示“已选择”栏，并根据是否有选中项控制按钮可用
        elements.actionBar.style.display = 'flex';
        elements.groupActionBar.style.display = 'none';
        elements.addToGroupBtn.disabled = selectedCount === 0;
        elements.cancelSelectBtn.disabled = selectedCount === 0;
    }

    document.querySelectorAll('.app-card').forEach(card => {
        const isSelected = state.selectedApps.has(card.dataset.id);
        card.classList.toggle('selected', isSelected);
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = isSelected;
    });
}

export function clearSelection() {
    state.selectedApps.clear();
    updateSelectionUI();
}

export function closeAllMenus(event) {
    if (!event.target.closest('.group-menu-wrapper')) {
        document.querySelectorAll('.group-dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
    }
    if (!event.target.closest('.app-more-menu')) {
        document.querySelectorAll('.app-dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
    }
}

