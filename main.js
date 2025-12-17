const { app, BrowserWindow, ipcMain, Menu, dialog, nativeImage, shell, Tray } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let tray = null;
let isQuiting = false;

// 默认数据存储路径
const defaultDataDir = app.getPath('userData');
const settingsFile = path.join(defaultDataDir, 'settings.json');

// 获取当前存储目录
function getDataDir() {
    const settings = loadSettings();
    return settings.dataDir || defaultDataDir;
}

// 获取数据文件路径
function getDataPath() {
    return path.join(getDataDir(), 'groups.json');
}

function getCustomPathsFile() {
    return path.join(getDataDir(), 'customPaths.json');
}

function getPortableAppsFile() {
    return path.join(getDataDir(), 'portableApps.json');
}

function createTray() {
    if (tray) return;

    let icon = null;
    try {
        // 优先使用打包后的应用图标（例如 electron-builder 的图标）
        const candidateIcons = [
            path.join(process.resourcesPath || __dirname, 'icon.ico'),
            path.join(process.resourcesPath || __dirname, 'icon.png'),
            path.join(__dirname, 'icon.ico'),
            path.join(__dirname, 'icon.png')
        ];

        for (const p of candidateIcons) {
            if (fs.existsSync(p)) {
                const img = nativeImage.createFromPath(p);
                if (!img.isEmpty()) {
                    icon = img;
                    break;
                }
            }
        }

        // 最后退回到默认应用图标（在部分 Windows 环境下可从 exe 中提取）
        if (!icon || icon.isEmpty()) {
            const exeIcon = nativeImage.createFromPath(process.execPath);
            if (!exeIcon.isEmpty()) {
                icon = exeIcon;
            }
        }

        if (!icon || icon.isEmpty()) {
            icon = nativeImage.createEmpty();
        }
    } catch {
        icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);
    tray.setToolTip('软件管理器');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示主窗口',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        } else {
            createWindow();
        }
    });
}

function destroyTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}

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

    const settings = loadSettings();
    const initialCloseBehavior = settings.closeBehavior || 'exit';
    const initialShowPrompt = settings.closePrompt !== false;

    mainWindow.on('close', (e) => {
        if (isQuiting) {
            destroyTray();
            return;
        }

        const latestSettings = loadSettings();
        const behavior = latestSettings.closeBehavior || initialCloseBehavior || 'exit';
        const showPrompt = latestSettings.closePrompt !== false && initialShowPrompt;

        if (!showPrompt) {
            if (behavior === 'hide') {
                e.preventDefault();
                createTray();
                mainWindow.hide();
            } else {
                isQuiting = true;
                destroyTray();
                // 允许窗口正常关闭
            }
            return;
        }

        e.preventDefault();

        dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['隐藏到系统托盘', '直接退出', '取消'],
            defaultId: behavior === 'hide' ? 0 : 1,
            cancelId: 2,
            title: '关闭应用',
            message: '请选择关闭应用时的操作：',
            checkboxLabel: '下次不再提示，记住我的选择',
            checkboxChecked: false
        }).then(({ response, checkboxChecked }) => {
            if (response === 2) {
                return;
            }

            const newBehavior = response === 0 ? 'hide' : 'exit';
            const s = loadSettings();
            s.closeBehavior = newBehavior;
            if (checkboxChecked) {
                s.closePrompt = false;
            }
            saveSettings(s);

            if (newBehavior === 'hide') {
                createTray();
                mainWindow.hide();
            } else {
                isQuiting = true;
                destroyTray();
                mainWindow.close();
            }
        });
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
});

app.on('before-quit', () => {
    isQuiting = true;
    destroyTray();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 检查路径是否为有效的可执行文件
function isValidExePath(exePath) {
    if (!exePath || !exePath.endsWith('.exe')) return false;
    try {
        return fs.existsSync(exePath);
    } catch {
        return false;
    }
}

// 扫描开始菜单快捷方式
async function scanStartMenuShortcuts() {
    return new Promise((resolve) => {
        const shortcuts = new Map(); // name -> {path, publisher}
        
        // 开始菜单目录
        const startMenuPaths = [
            path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
            path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        ];

        // 使用 PowerShell 解析快捷方式
        const psScript = `
            $shell = New-Object -ComObject WScript.Shell
            $results = @()
            $paths = @(${startMenuPaths.map(p => `'${p.replace(/\\/g, '\\\\')}'`).join(',')})
            foreach ($basePath in $paths) {
                if (Test-Path $basePath) {
                    Get-ChildItem -Path $basePath -Recurse -Filter "*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
                        try {
                            $shortcut = $shell.CreateShortcut($_.FullName)
                            $target = $shortcut.TargetPath
                            if ($target -and $target.EndsWith('.exe') -and (Test-Path $target)) {
                                $name = $_.BaseName
                                $results += "$name|$target"
                            }
                        } catch {}
                    }
                }
            }
            $results -join ";;;"
        `;

        exec(`chcp 65001 >nul && powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, 
            { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }, 
            (error, stdout) => {
                if (!error && stdout) {
                    const items = stdout.trim().split(';;;');
                    items.forEach(item => {
                        const [name, targetPath] = item.split('|');
                        if (name && targetPath && targetPath.endsWith('.exe')) {
                            // 过滤掉卸载程序和帮助文件
                            const lowerName = name.toLowerCase();
                            if (!lowerName.includes('uninstall') && 
                                !lowerName.includes('卸载') &&
                                !lowerName.includes('help') &&
                                !lowerName.includes('帮助') &&
                                !lowerName.includes('readme') &&
                                !lowerName.includes('website') &&
                                !lowerName.includes('官网')) {
                                shortcuts.set(name, { path: targetPath });
                            }
                        }
                    });
                }
                resolve(shortcuts);
            }
        );
    });
}

// 扫描已安装的应用程序
async function scanInstalledApps() {
    // 先扫描开始菜单快捷方式
    const shortcutsMap = await scanStartMenuShortcuts();
    
    return new Promise((resolve) => {
        const appsMap = new Map(); // 使用 Map 进行去重和合并
        const registryPaths = [
            'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
            'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
            'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
        ];

        let completed = 0;
        const processPath = (regPath) => {
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
                            // 过滤掉系统更新和无效条目
                            if (!displayName.startsWith('KB') &&
                                !displayName.includes('Update for') &&
                                !displayName.includes('Security Update') &&
                                !displayName.includes('Hotfix')) {

                                // 获取可执行文件路径
                                let exePath = '';
                                if (displayIcon) {
                                    exePath = displayIcon.split(',')[0].replace(/"/g, '').trim();
                                }
                                if ((!exePath || !exePath.endsWith('.exe')) && installLocation) {
                                    exePath = installLocation;
                                }

                                const appId = Buffer.from(displayName).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
                                
                                // 检查是否已存在
                                if (appsMap.has(displayName)) {
                                    // 如果已存在，比较路径有效性，选择更好的
                                    const existing = appsMap.get(displayName);
                                    if (!isValidExePath(existing.path) && isValidExePath(exePath)) {
                                        existing.path = exePath;
                                    }
                                    if (!existing.publisher && publisher) {
                                        existing.publisher = publisher;
                                    }
                                } else {
                                    appsMap.set(displayName, {
                                        id: appId,
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
                    // 合并开始菜单快捷方式的信息
                    shortcutsMap.forEach((shortcutInfo, shortcutName) => {
                        // 尝试匹配已有应用
                        let matched = false;
                        for (const [appName, appInfo] of appsMap) {
                            // 模糊匹配：快捷方式名称包含应用名或应用名包含快捷方式名称
                            const appNameLower = appName.toLowerCase();
                            const shortcutNameLower = shortcutName.toLowerCase();
                            if (appNameLower.includes(shortcutNameLower) || 
                                shortcutNameLower.includes(appNameLower) ||
                                appNameLower.replace(/\s/g, '') === shortcutNameLower.replace(/\s/g, '')) {
                                // 如果匹配到且快捷方式路径有效而原路径无效，则更新
                                if (!isValidExePath(appInfo.path) && isValidExePath(shortcutInfo.path)) {
                                    appInfo.path = shortcutInfo.path;
                                }
                                matched = true;
                                break;
                            }
                        }
                        
                        // 如果没有匹配到，作为新应用添加
                        if (!matched && isValidExePath(shortcutInfo.path)) {
                            const appId = Buffer.from(shortcutName).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
                            appsMap.set(shortcutName, {
                                id: appId,
                                name: shortcutName,
                                path: shortcutInfo.path,
                                installLocation: path.dirname(shortcutInfo.path),
                                publisher: '',
                                isRunning: false,
                                isPortable: false
                            });
                        }
                    });

                    // 转换为数组并排序
                    const apps = Array.from(appsMap.values());
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
        const dataPath = getDataPath();
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
        const dataPath = getDataPath();
        // 确保目录存在
        const dir = path.dirname(dataPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
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
        const customPathsFile = getCustomPathsFile();
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
        const portableAppsFile = getPortableAppsFile();
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
        const portableAppsFile = getPortableAppsFile();
        // 确保目录存在
        const dir = path.dirname(portableAppsFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
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
    return { theme: 'dark', closeBehavior: 'exit', closePrompt: true };
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

// 停止应用
ipcMain.handle('stop-app', async (event, appPath) => {
    try {
        if (!appPath) {
            return { success: false, error: '路径为空' };
        }
        
        const exeName = path.basename(appPath);
        
        return new Promise((resolve) => {
            exec(`taskkill /IM "${exeName}" /F`, { encoding: 'utf8' }, (error, stdout, stderr) => {
                if (error) {
                    // 检查是否是因为进程不存在
                    if (stderr && stderr.includes('not found')) {
                        resolve({ success: false, error: '应用未运行' });
                    } else {
                        resolve({ success: false, error: error.message });
                    }
                } else {
                    resolve({ success: true });
                }
            });
        });
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
        const customPathsFile = getCustomPathsFile();
        // 确保目录存在
        const dir = path.dirname(customPathsFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
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

// 获取所有设置
ipcMain.handle('get-settings', () => {
    const settings = loadSettings();
    return {
        theme: settings.theme || 'dark',
        dataDir: settings.dataDir || defaultDataDir,
        defaultDataDir: defaultDataDir,
        closeBehavior: settings.closeBehavior || 'exit',
        closePrompt: settings.closePrompt !== false
    };
});

// 保存所有设置
ipcMain.handle('save-settings', (event, newSettings) => {
    try {
        const settings = loadSettings();
        Object.assign(settings, newSettings);
        return saveSettings(settings);
    } catch (error) {
        console.error('保存设置失败:', error);
        return false;
    }
});

// 选择存储目录
ipcMain.handle('select-storage-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: '选择数据存储目录',
        properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return { dirPath: result.filePaths[0] };
    }
    return null;
});

// 获取当前存储目录信息
ipcMain.handle('get-storage-info', () => {
    const settings = loadSettings();
    return {
        currentDir: settings.dataDir || defaultDataDir,
        defaultDir: defaultDataDir,
        isCustom: !!settings.dataDir && settings.dataDir !== defaultDataDir
    };
});

// 打开应用所在目录
ipcMain.handle('open-directory', async (event, filePath) => {
    try {
        if (!filePath) {
            return { success: false, error: '路径为空' };
        }
        
        // 获取文件所在目录
        const dirPath = path.dirname(filePath);
        
        if (!fs.existsSync(dirPath)) {
            return { success: false, error: '目录不存在' };
        }
        
        // 打开目录并选中文件
        shell.showItemInFolder(filePath);
        return { success: true };
    } catch (error) {
        console.error('打开目录失败:', error);
        return { success: false, error: error.message };
    }
});
