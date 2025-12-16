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
    elements.selectedCount.textContent = state.selectedApps.size;

    if (state.currentGroupId) {
        elements.actionBar.style.display = 'none';
        elements.groupActionBar.style.display = 'flex';
        elements.removeFromGroupBtn.disabled = state.selectedApps.size === 0;
    } else {
        elements.actionBar.style.display = state.selectedApps.size > 0 ? 'flex' : 'none';
        elements.groupActionBar.style.display = 'none';
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

