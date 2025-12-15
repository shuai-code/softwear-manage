const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 扫描已安装的应用
    scanApps: () => ipcRenderer.invoke('scan-apps'),

    // 检查应用是否运行
    checkRunning: (appPath) => ipcRenderer.invoke('check-running', appPath),

    // 启动应用
    launchApp: (appPath) => ipcRenderer.invoke('launch-app', appPath),

    // 获取分组列表
    getGroups: () => ipcRenderer.invoke('get-groups'),

    // 保存分组
    saveGroups: (groups) => ipcRenderer.invoke('save-groups', groups),

    // 刷新运行状态
    refreshRunningStatus: (apps) => ipcRenderer.invoke('refresh-running-status', apps),

    // 选择可执行文件
    selectExeFile: () => ipcRenderer.invoke('select-exe-file'),

    // 保存自定义路径
    saveCustomPath: (appId, path) => ipcRenderer.invoke('save-custom-path', appId, path),

    // 获取应用图标
    getAppIcon: (appPath) => ipcRenderer.invoke('get-app-icon', appPath),

    // 添加便携应用
    addPortableApp: (app) => ipcRenderer.invoke('add-portable-app', app),

    // 获取便携应用列表
    getPortableApps: () => ipcRenderer.invoke('get-portable-apps'),

    // 删除便携应用
    removePortableApp: (appId) => ipcRenderer.invoke('remove-portable-app', appId),

    // 保存主题设置
    saveTheme: (theme) => ipcRenderer.invoke('save-theme', theme),

    // 获取主题设置
    getTheme: () => ipcRenderer.invoke('get-theme')
});
