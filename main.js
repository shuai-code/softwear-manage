const { app, BrowserWindow, ipcMain, Menu, dialog, nativeImage } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');

let mainWindow;

// 数据存储路径
const dataPath = path.join(app.getPath('userData'), 'groups.json');
const customPathsFile = path.join(app.getPath('userData'), 'customPaths.json');
const portableAppsFile = path.join(app.getPath('userData'), 'portableApps.json');
const settingsFile = path.join(app.getPath('userData'), 'settings.json');

function createWindow() {
    // 隐藏菜单栏
    Menu.setApplicationMenu(null);

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        frame: true,
        backgroundColor: '#1a1a2e',
        autoHideMenuBar: true
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 扫描已安装的应用程序
async function scanInstalledApps() {
    return new Promise((resolve) => {
        const apps = [];
        const registryPaths = [
            'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
            'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
            'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
        ];

        let completed = 0;
        const processPath = (regPath) => {
            // 使用 reg query 命令获取应用信息，chcp 65001 切换到 UTF-8 编码
            exec(`chcp 65001 >nul && reg query "${regPath}" /s`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }, (error, stdout) => {
                if (!error && stdout) {
                    const entries = stdout.split(/\r?\n\r?\n/);

                    entries.forEach(entry => {
                        const lines = entry.split(/\r?\n/);
                        let displayName = '';
                        let installLocation = '';
                        let displayIcon = '';
                        let publisher = '';

                        lines.forEach(line => {
                            const displayNameMatch = line.match(/^\s*DisplayName\s+REG_SZ\s+(.+)$/);
                            const installLocationMatch = line.match(/^\s*InstallLocation\s+REG_SZ\s+(.+)$/);
                            const displayIconMatch = line.match(/^\s*DisplayIcon\s+REG_SZ\s+(.+)$/);
                            const publisherMatch = line.match(/^\s*Publisher\s+REG_SZ\s+(.+)$/);

                            if (displayNameMatch) displayName = displayNameMatch[1].trim();
                            if (installLocationMatch) installLocation = installLocationMatch[1].trim();
                            if (displayIconMatch) displayIcon = displayIconMatch[1].trim();
                            if (publisherMatch) publisher = publisherMatch[1].trim();
                        });

                        if (displayName && displayName.length > 0) {
                            // 获取可执行文件路径
                            let exePath = '';
                            if (displayIcon) {
                                // displayIcon 可能包含逗号和图标索引，需要处理
                                exePath = displayIcon.split(',')[0].replace(/"/g, '').trim();
                            }

                            // 如果没有从displayIcon获取到，尝试从installLocation查找
                            if ((!exePath || !exePath.endsWith('.exe')) && installLocation) {
                                exePath = installLocation;
                            }

                            // 过滤掉系统更新和无效条目
                            if (!displayName.startsWith('KB') &&
                                !displayName.includes('Update for') &&
                                !displayName.includes('Security Update') &&
                                !displayName.includes('Hotfix')) {

                                // 避免重复
                                const exists = apps.some(a => a.name === displayName);
                                if (!exists) {
                                    apps.push({
                                        id: Buffer.from(displayName).toString('base64').replace(/[^a-zA-Z0-9]/g, ''),
                                        name: displayName,
                                        path: exePath,
                                        installLocation: installLocation,
                                        publisher: publisher,
                                        isRunning: false,
                                        isPortable: false
                                    });
                                }
                            }
                        }
                    });
                }

                completed++;
                if (completed === registryPaths.length) {
                    // 按名称排序
                    apps.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                    resolve(apps);
                }
            });
        };

        registryPaths.forEach(processPath);
    });
}

// 获取运行中的进程列表
async function getRunningProcesses() {
    return new Promise((resolve) => {
        exec('chcp 65001 >nul && tasklist /FO CSV /NH', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
            if (error) {
                resolve([]);
                return;
            }

            const processes = [];
            const lines = stdout.split('\n');
            lines.forEach(line => {
                const match = line.match(/"([^"]+)"/);
                if (match) {
                    processes.push(match[1].toLowerCase());
                }
            });
            resolve(processes);
        });
    });
}

// 检查应用是否正在运行
async function checkAppRunning(appPath) {
    const processes = await getRunningProcesses();
    if (!appPath) return false;

    const exeName = path.basename(appPath).toLowerCase();
    return processes.includes(exeName);
}

// 启动应用程序
async function launchApp(appPath) {
    return new Promise((resolve, reject) => {
        if (!appPath || !fs.existsSync(appPath)) {
            reject(new Error('应用程序路径无效'));
            return;
        }

        try {
            const child = spawn(appPath, [], {
                detached: true,
                stdio: 'ignore',
                cwd: path.dirname(appPath)
            });
            child.unref();
            resolve(true);
        } catch (error) {
            reject(error);
        }
    });
}

// 加载分组数据
function loadGroups() {
    try {
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('加载分组数据失败:', error);
    }
    return [];
}

// 保存分组数据
function saveGroups(groups) {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(groups, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('保存分组数据失败:', error);
        return false;
    }
}

// 加载自定义路径
function loadCustomPaths() {
    try {
        if (fs.existsSync(customPathsFile)) {
            const data = fs.readFileSync(customPathsFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('加载自定义路径失败:', error);
    }
    return {};
}

// 加载便携应用列表
function loadPortableApps() {
    try {
        if (fs.existsSync(portableAppsFile)) {
            const data = fs.readFileSync(portableAppsFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('加载便携应用失败:', error);
    }
    return [];
}

// 保存便携应用列表
function savePortableApps(apps) {
    try {
        fs.writeFileSync(portableAppsFile, JSON.stringify(apps, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('保存便携应用失败:', error);
        return false;
    }
}

// 加载设置
function loadSettings() {
    try {
        if (fs.existsSync(settingsFile)) {
            const data = fs.readFileSync(settingsFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('加载设置失败:', error);
    }
    return { theme: 'dark' };
}

// 保存设置
function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('保存设置失败:', error);
        return false;
    }
}

// 获取应用图标
async function getAppIcon(appPath) {
    try {
        if (!appPath || !fs.existsSync(appPath)) {
            return null;
        }

        const icon = await app.getFileIcon(appPath, { size: 'large' });
        return icon.toDataURL();
    } catch (error) {
        console.error('获取图标失败:', error);
        return null;
    }
}

// IPC 处理
ipcMain.handle('scan-apps', async () => {
    const apps = await scanInstalledApps();
    const processes = await getRunningProcesses();
    const customPaths = loadCustomPaths();
    const portableApps = loadPortableApps();

    // 合并自定义路径并更新运行状态
    apps.forEach(app => {
        // 如果有自定义路径，使用自定义路径
        if (customPaths[app.id]) {
            app.path = customPaths[app.id];
        }

        if (app.path) {
            const exeName = path.basename(app.path).toLowerCase();
            app.isRunning = processes.includes(exeName);
        }
    });

    // 合并便携应用
    portableApps.forEach(portableApp => {
        // 避免重复
        const exists = apps.some(a => a.id === portableApp.id);
        if (!exists) {
            if (portableApp.path) {
                const exeName = path.basename(portableApp.path).toLowerCase();
                portableApp.isRunning = processes.includes(exeName);
            }
            apps.push(portableApp);
        }
    });

    // 重新排序
    apps.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    return apps;
});

ipcMain.handle('check-running', async (event, appPath) => {
    return await checkAppRunning(appPath);
});

ipcMain.handle('launch-app', async (event, appPath) => {
    try {
        await launchApp(appPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-groups', () => {
    return loadGroups();
});

ipcMain.handle('save-groups', (event, groups) => {
    return saveGroups(groups);
});

ipcMain.handle('refresh-running-status', async (event, apps) => {
    const processes = await getRunningProcesses();
    return apps.map(app => ({
        ...app,
        isRunning: app.path ? processes.includes(path.basename(app.path).toLowerCase()) : false
    }));
});

// 选择可执行文件对话框
ipcMain.handle('select-exe-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: '选择可执行文件',
        filters: [
            { name: '可执行文件', extensions: ['exe'] },
            { name: '所有文件', extensions: ['*'] }
        ],
        properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return { filePath: result.filePaths[0] };
    }
    return null;
});

// 保存自定义路径
ipcMain.handle('save-custom-path', (event, appId, customPath) => {
    try {
        const customPaths = loadCustomPaths();
        customPaths[appId] = customPath;
        fs.writeFileSync(customPathsFile, JSON.stringify(customPaths, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('保存自定义路径失败:', error);
        return false;
    }
});

// 获取应用图标
ipcMain.handle('get-app-icon', async (event, appPath) => {
    return await getAppIcon(appPath);
});

// 添加便携应用
ipcMain.handle('add-portable-app', (event, appData) => {
    try {
        const portableApps = loadPortableApps();

        const newApp = {
            id: 'portable_' + Date.now().toString(),
            name: appData.name,
            path: appData.path,
            publisher: appData.publisher || '便携应用',
            installLocation: path.dirname(appData.path),
            isRunning: false,
            isPortable: true
        };

        portableApps.push(newApp);
        savePortableApps(portableApps);

        return { success: true, app: newApp };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 获取便携应用列表
ipcMain.handle('get-portable-apps', () => {
    return loadPortableApps();
});

// 删除便携应用
ipcMain.handle('remove-portable-app', (event, appId) => {
    try {
        let portableApps = loadPortableApps();
        portableApps = portableApps.filter(app => app.id !== appId);
        savePortableApps(portableApps);
        return true;
    } catch (error) {
        console.error('删除便携应用失败:', error);
        return false;
    }
});

// 保存主题设置
ipcMain.handle('save-theme', (event, theme) => {
    const settings = loadSettings();
    settings.theme = theme;
    return saveSettings(settings);
});

// 获取主题设置
ipcMain.handle('get-theme', () => {
    const settings = loadSettings();
    return settings.theme || 'dark';
});
