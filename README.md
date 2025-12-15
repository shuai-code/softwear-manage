# 🖥️ Softwear-Manage

<p align="center">
  <img src="https://img.shields.io/badge/Electron-28.0.0-47848F?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

<p align="center">
  一款完全使用 AI 生成的基于 Electron 开发的 Windows 应用程序管理与快速启动工具
</p>

---

## ✨ 功能特性

### 📦 应用扫描
- 自动扫描 Windows 系统注册表，获取所有已安装的应用程序
- 显示应用名称、发布者、安装路径等信息
- 自动提取并显示应用程序图标
- 实时检测应用运行状态

### 📁 分组管理
- 创建自定义分组，对应用进行分类管理
- 支持多选应用批量添加到分组
- 分组数据本地持久化存储

### 🚀 快速启动
- 一键启动分组内的所有应用
- 自动跳过已运行的应用，避免重复启动
- 支持单个应用快速启动

### ➕ 便携应用支持
- 支持手动添加绿色便携式应用（非安装版）
- 自定义应用名称和发布者信息
- 便携应用与扫描应用统一管理

### 🎨 界面特性
- 支持深色/浅色主题切换
- 现代化 UI 设计，流畅动画效果
- 响应式布局，支持窗口缩放
- 应用按"可运行"和"缺少路径"分区显示

### 🔧 其他功能
- 为缺少执行路径的应用手动指定 exe 文件
- 应用搜索过滤
- 运行状态实时刷新

---

## 📸 界面预览

### 深色主题
应用默认使用深色主题，适合夜间使用，减少眼睛疲劳。

### 浅色主题
点击工具栏的主题切换按钮（🌙/☀️）可切换到浅色主题。

---

## 🛠️ 安装与运行

### 环境要求
- Node.js 18.0+
- Windows 10/11

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/your-username/softwear-manage.git
cd softwear-manage
```

2. **安装依赖**
```bash
npm install
```

3. **启动应用**
```bash
npm start
```

### 打包构建

构建 Windows 安装包：
```bash
npm run build
```

构建产物位于 `dist` 目录。

---

## 📖 使用说明

### 扫描应用
1. 启动程序后，点击右上角的 **"🔍 扫描应用"** 按钮
2. 等待扫描完成，已安装的应用将显示在列表中
3. 应用图标会异步加载显示

### 创建分组
1. 点击侧边栏的 **"+"** 按钮
2. 输入分组名称，点击创建
3. 在应用列表中勾选需要添加的应用
4. 点击 **"➕ 添加到分组"**，选择目标分组

### 快速启动
1. 在侧边栏点击目标分组
2. 点击 **"🚀 快速启动全部"** 按钮
3. 分组内所有未运行的应用将依次启动

### 添加便携应用
1. 点击侧边栏底部的 **"➕ 添加便携应用"** 按钮
2. 填写应用名称
3. 点击"浏览"选择 exe 可执行文件
4. （可选）填写发布者名称
5. 点击"添加"完成

### 切换主题
点击工具栏的 **🌙** 或 **☀️** 按钮切换深色/浅色主题。

---

## 📁 项目结构

```
soft-manage/
├── main.js          # Electron 主进程
├── preload.js       # 预加载脚本（IPC 桥接）
├── renderer.js      # 渲染进程逻辑
├── index.html       # 主界面
├── styles.css       # 样式文件
├── package.json     # 项目配置
└── README.md        # 项目说明
```

### 数据存储位置
应用数据存储在用户目录下：
```
%APPDATA%/soft-manage/
├── groups.json        # 分组数据
├── customPaths.json   # 自定义应用路径
├── portableApps.json  # 便携应用列表
└── settings.json      # 用户设置（主题等）
```

---

## 🔧 技术栈

- **Electron** - 跨平台桌面应用框架
- **Node.js** - 运行时环境
- **原生 JavaScript** - 无框架依赖，轻量高效
- **CSS3** - 现代样式与动画
- **Windows Registry** - 应用扫描数据源

---

## 📝 开发说明

### 应用扫描原理
通过读取 Windows 注册表以下路径获取已安装应用信息：
- `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`
- `HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`
- `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`

### 运行状态检测
通过 `tasklist` 命令获取当前运行的进程列表，与应用的 exe 文件名进行匹配。

### 图标提取
使用 Electron 的 `app.getFileIcon()` API 从 exe 文件提取应用图标。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 🙏 致谢

感谢所有为本项目提供建议和反馈的用户！

---

<p align="center">
  Made with ❤️ using Electron
</p>

