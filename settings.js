import { state, elements } from './state.js';
import { showModal, hideModal, showToast } from './ui.js';

export async function loadSettings() {
    try {
        const settings = await window.electronAPI.getSettings();
        state.currentTheme = settings.theme || 'dark';
        applyTheme(state.currentTheme);

        if (elements.storagePathInput) {
            elements.storagePathInput.value = settings.dataDir || settings.defaultDataDir;
        }
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeSwitcher(theme);
}

function updateThemeSwitcher(theme) {
    if (elements.themeSwitcher) {
        elements.themeSwitcher.querySelectorAll('.theme-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }
}

async function switchTheme(theme) {
    state.currentTheme = theme;
    applyTheme(state.currentTheme);
    await window.electronAPI.saveTheme(state.currentTheme);
    showToast(`已切换到${state.currentTheme === 'dark' ? '深色' : '浅色'}主题`, 'success');
}

async function openSettings() {
    try {
        const settings = await window.electronAPI.getSettings();
        elements.storagePathInput.value = settings.dataDir || settings.defaultDataDir;
        updateThemeSwitcher(settings.theme || 'dark');
    } catch (error) {
        console.error('加载设置失败:', error);
    }
    showModal('settingsModal');
}

async function browseStoragePath() {
    try {
        const result = await window.electronAPI.selectStorageDir();
        if (result && result.dirPath) {
            elements.storagePathInput.value = result.dirPath;
            await window.electronAPI.saveSettings({ dataDir: result.dirPath });
            showToast('存储目录已更新，重启应用后生效', 'info');
        }
    } catch (error) {
        showToast('选择目录失败', 'error');
    }
}

async function resetStoragePath() {
    try {
        const settings = await window.electronAPI.getSettings();
        elements.storagePathInput.value = settings.defaultDataDir;
        await window.electronAPI.saveSettings({ dataDir: settings.defaultDataDir });
        showToast('存储目录已重置为默认位置', 'success');
    } catch (error) {
        showToast('重置失败', 'error');
    }
}

export function initSettingsEvents() {
    elements.settingsBtn.addEventListener('click', openSettings);
    document.getElementById('closeSettingsModal').addEventListener('click', () => hideModal('settingsModal'));
    document.getElementById('closeSettingsBtn').addEventListener('click', () => hideModal('settingsModal'));

    elements.themeSwitcher.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => switchTheme(btn.dataset.theme));
    });

    elements.browseStoragePathBtn.addEventListener('click', browseStoragePath);
    elements.resetStoragePathBtn.addEventListener('click', resetStoragePath);
}

