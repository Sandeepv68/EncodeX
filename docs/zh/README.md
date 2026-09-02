<div align="center">
  <img src="../../assets/banner.png" alt="EncodeX Logo" width="900" />
  <h3>一款基于 FFmpeg、React、TypeScript 和 Electron 构建的跨平台多媒体转换工具。</h3>
</div>

<div align="center">

[![Ask DeepWiki](https://img.shields.io/badge/Ask_DeepWiki-10B981?style=for-the-badge)](https://deepwiki.com/Sandeepv68/EncodeX)
![CI](https://img.shields.io/github/actions/workflow/status/Sandeepv68/EncodeX/ci.yml?style=for-the-badge)
![License](https://img.shields.io/github/license/Sandeepv68/EncodeX?style=for-the-badge)
![Release](https://img.shields.io/github/v/release/Sandeepv68/EncodeX?style=for-the-badge)
![Downloads](https://img.shields.io/github/downloads/Sandeepv68/EncodeX/total?style=for-the-badge&logo=github&logoColor=white)
![Stars](https://img.shields.io/github/stars/Sandeepv68/EncodeX?style=for-the-badge)
![Forks](https://img.shields.io/github/forks/Sandeepv68/EncodeX?style=for-the-badge)
![Watchers](https://img.shields.io/github/watchers/Sandeepv68/EncodeX?style=for-the-badge)
![Issues](https://img.shields.io/github/issues/Sandeepv68/EncodeX?style=for-the-badge)
![Pull Requests](https://img.shields.io/github/issues-pr/Sandeepv68/EncodeX?style=for-the-badge)
![Last Commit](https://img.shields.io/github/last-commit/Sandeepv68/EncodeX?style=for-the-badge)
![Contributors](https://img.shields.io/github/contributors/Sandeepv68/EncodeX?style=for-the-badge)
![Repo Size](https://img.shields.io/github/repo-size/Sandeepv68/EncodeX?style=for-the-badge)
![Languages](https://img.shields.io/github/languages/count/Sandeepv68/EncodeX?style=for-the-badge)
![Top Language](https://img.shields.io/github/languages/top/Sandeepv68/EncodeX?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![MUI](https://img.shields.io/badge/MUI-007FFF?style=for-the-badge&logo=mui&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%2022-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)

</div>

<div align="center">

[English](../../README.md) | [Deutsch](../de/README.md) | [Español](../es/README.md) | [Français](../fr/README.md) | [हिन्दी](../hi/README.md) | [Português](../pt/README.md) | [简体中文](./README.md)

</div>

## 👋 简介

EncodeX 是一款跨平台多媒体转换工具，将 FFmpeg 的强大功能带到现代、直观的桌面界面中。它基于 Electron、React 和 TypeScript 构建，让您可以在不同格式之间转换媒体、提取音频、裁剪视频以及压缩图片——所有这些都通过一个干净且响应迅速的界面完成，并配有批量队列、硬件加速、CLI 模式以及完整的国际化支持。

## ✨ 功能特性

- **🔄 媒体转换** — 51 种视频编解码器、27 种音频编解码器、56 种像素格式，支持编解码器/码率/缩放/质量设置
- **🎛️ 转换配置文件** — 8 个类别（YouTube、Instagram、TikTok、Apple、Android、ProRes、HLS 等）中 140+ 个预配置预设，支持自定义配置文件创建和最近使用跟踪
- **⚡ 硬件加速** — NVIDIA NVENC、Intel QSV、AMD AMF、VAAPI、Apple VideoToolbox、Media Foundation
- **✂️ 视频裁剪** — 借助内置播放器实现逐帧精确裁剪（rawvideo + PCM 管道、Canvas + Web Audio），并提供可缩放的进度条（波形 + 缩略图拼接）
- **📋 批量队列** — 并行处理（最多 4 个并发任务），支持实时进度、逐任务错误、暂停/继续、拖拽重新排序、任务选项编辑、状态筛选、JSON 导出/导入，以及完成后的电源操作（关机/睡眠/休眠）
- **🖼️ 图片压缩** — JPEG/PNG/WebP/BMP/GIF/TIFF，支持质量/缩放设置、EXIF 查看器、RGB/亮度直方图
- **🎵 音频提取** — 从任意视频文件中提取任意一种（共 27 种）音频编解码器
- **ℹ️ 媒体信息** — 完整的逐流探测：编解码器、配置、分辨率、色彩元数据、帧率等
- **⌨️ CLI 模式** — 无头脚本，支持子命令（`convert`、`info`、`capabilities`、`compress`、`extract-audio`、`batch`）
- **⚙️ 3 个转码核心** — FFmpeg API（fluent-ffmpeg）、FFmpeg CLI（child_process）、BMF Framework
- **🌍 56 种语言环境** — 35 种语言，支持 RTL（阿拉伯语、希伯来语）
- **⌨️ 键盘快捷键** — 每个页面都有 60+ 快捷键，并提供应用内帮助对话框（`Ctrl+/`）
- **🔔 活动提示点** — 实时导航指示器，悬停弹出窗口可让您一眼看到每个任务的进度
- **🛡️ 关闭确认** — 在任务仍在运行时关闭窗口前进行提醒
- **🎉 彩蛋** — 在特殊日期显示节日主题的应用图标
- **🔄 应用内更新** — 检查 GitHub Releases、下载平台安装程序、实时进度
- **🛡️ 错误处理** — 16 个带类型的错误码、全局 snackbar、内联横幅、React 错误边界
- **🌗 深色/浅色主题** — 跟随系统并支持手动切换，偏好设置持久保存

如需完整的功能详解、支持的格式以及编解码器列表，请参阅 [功能参考](./features-reference.md)。

## 📸 截图

<div align="center">
  <img src="../../site/public/images/home_dashboard.webp" alt="Home Dashboard" width="800" />
  <p><strong>🏠 首页仪表盘</strong></p>
</div>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="../../site/public/images/convert.webp" alt="Media Conversion" /><br />
      <strong>🔄 媒体转换</strong>
    </td>
    <td align="center" width="50%">
      <img src="../../site/public/images/extract_audio.webp" alt="Audio Extraction" /><br />
      <strong>🎵 音频提取</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../../site/public/images/cut_video.webp" alt="Video Cutting" /><br />
      <strong>✂️ 视频裁剪</strong>
    </td>
    <td align="center">
      <img src="../../site/public/images/image_compress.webp" alt="Image Compression" /><br />
      <strong>🖼️ 图片压缩</strong>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../../site/public/images/batch_process.webp" alt="Batch Queue" /><br />
      <strong>📋 批量队列</strong>
    </td>
    <td align="center">
      <img src="../../site/public/images/media_info.webp" alt="Media Info" /><br />
      <strong>ℹ️ 媒体信息</strong>
    </td>
  </tr>
</table>

## 📌 环境要求

- [Node.js](https://nodejs.org/) 22+
- [FFmpeg](https://ffmpeg.org/) — 通过 `ffmpeg-static` 随附；若捆绑的二进制不可用，则回退到系统 `ffmpeg`

## 📥 下载

预构建的安装程序可在 [Releases](https://github.com/Sandeepv68/EncodeX/releases) 页面获取。

### macOS

> EncodeX 未进行代码签名（没有 Apple Developer 账户）。macOS Gatekeeper 会在首次打开时拦截该应用。

**选项 1 — 右键点击打开：**

1. 右键（或按住 Control 点击）EncodeX 应用，然后选择 **打开**
2. 在确认对话框中点击 **打开**

**选项 2 — 通过终端移除隔离属性：**

```bash
xattr -cr /Applications/EncodeX.app
```

### Windows / Linux

从 [Releases](https://github.com/Sandeepv68/EncodeX/releases) 页面下载 `.exe`（Windows）或 `.AppImage`（Linux）安装程序并运行它。

## 🚀 安装（从源码）

```bash
npm install
```

## 🧑‍💻 开发

```bash
# 启动 Vite 开发服务器 + tsc 监视（不打开 Electron 窗口）
npm run dev

# 带 Electron 窗口的完整开发环境
npm run electron:dev

# 快速启动（先构建再启动）
npm run dev:start
```

`npm run dev` 会并发启动两个进程：

1. **Vite** — 在 `http://localhost:5173` 上提供 React 渲染器并带有 HMR
2. **tsc** — 监视并将主进程 TypeScript 编译到 `dist/main/`

`npm run electron:dev` 会等待 Vite 就绪，然后编译主进程和预加载脚本，最后使用指向 Vite 开发服务器地址的 `--dev` 标志启动 Electron。DevTools 会自动打开。

## 🔨 构建

```bash
# 生产构建（渲染器 + 主进程 + 预加载）
npm run build

# 为当前平台打包（无安装程序）
npm run pack

# 创建可分发的安装程序
npm run dist
```

| 脚本                       | 说明                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `npm run dev:renderer`     | 仅启动 Vite 开发服务器                                      |
| `npm run dev:main`         | `tsc -p tsconfig.main.json --watch`                         |
| `npm run build:renderer`   | Vite 生产构建 — 输出到 `dist/renderer/`                     |
| `npm run build:main`       | `tsc -p tsconfig.main.json` — 输出到 `dist/main/`           |
| `npm run build:preload`    | `tsc -p tsconfig.preload.json` — 输出到 `dist/preload/`     |
| `npm run build`            | 依次执行以上三条命令                                        |
| `npm run start`            | 通过 `electron .` 从 `dist/` 启动已编译的应用                |
| `npm run electron:dev`     | Vite + Electron 开发环境                                    |
| `npm run dev:start`        | 先构建再启动                                                |
| `npm run format`           | 对所有 `src` 中的 TypeScript/JSON 执行 `prettier --write`   |
| `npm run format:check`     | 对所有 `src` 中的 TypeScript/JSON 执行 `prettier --check`   |
| `npm run pack`             | 构建 + electron-builder `--dir`                             |
| `npm run dist`             | 构建 + electron-builder（NSIS/DMG/AppImage）                |

## 💻 CLI 用法

先构建项目，然后通过 `encodex` 调用：

```bash
encodex convert input.mp4 output.avi --video-codec libx265 --audio-codec aac
encodex info input.mp4 --json
encodex compress photo.png -f jpg -q 30
encodex extract-audio input.mp4
encodex batch 'videos/**/*.mov' --concurrency 2 --output-dir converted
```

如需了解所有子命令、选项和示例，请参阅 [CLI 用法](./cli.md)。

## 🧪 测试

```bash
npm test           # 运行全部 123 个测试文件 / 1603 个测试
npm run test:watch
npm run test:coverage
npm run test:unit
npm run test:integration
npm run test:e2e   # 需要先构建
```

如需了解完整的测试套件详解、测试设置和 E2E 规范，请参阅 [测试](./testing.md)。

## 📚 文档

| 文档 | 说明 |
| -------- | ----------- |
| [功能参考](./features-reference.md) | 功能特性、支持的媒体格式、编解码器表格、校验工具 |
| [CLI 用法](./cli.md) | CLI 用法、子命令、所有选项表格、退出码 |
| [测试](./testing.md) | 测试套件、测试设置、E2E 规范 |
| [IPC 通道](./ipc.md) | IPC 通道、electronAPI 桥接、所有方法与事件 |
| [项目结构](./project-structure.md) | 带注释的完整目录树 |
| [架构](./architecture.md) | 内部架构总览及深入解析的链接 |
| [架构：进程](./architecture-processes.md) | 进程模型、构建系统、启动序列、CLI 模式 |
| [架构：转码器](./architecture-transcoders.md) | 转码器抽象、FFmpeg/BMF 核心、硬件加速 |
| [架构：渲染器](./architecture-renderer.md) | 渲染树、页面、存储、队列、播放器、i18n、主题 |
| [更新管理器](./update-manager.md) | 应用内更新管理器的实现细节 |
| [Wiki](https://github.com/Sandeepv68/EncodeX/wiki) | 社区 Wiki（以可浏览的形式镜像文档） |
| [文档网站](https://encodex.in/zh/) | VitePress 网站，包含功能导览、指南和发布博客 |
| [参与贡献](./CONTRIBUTING.md) | 贡献指南 |
| [安全](../../SECURITY.md) | 漏洞报告 |
| [行为准则](../../CODE_OF_CONDUCT.md) | 行为准则 |

## 🧰 技术栈

<p align="center"><img src="../../assets/stack.png" alt="EncodeX tech stack"></p>

## 🤝 参与贡献

如需指南，请参阅 [参与贡献](./CONTRIBUTING.md)。欢迎所有形式的贡献——如有重大变更，请先提交 issue。

本项目受 [行为准则](../../CODE_OF_CONDUCT.md) 约束。

## 🔒 安全

请通过安全公告流程向项目维护者报告安全漏洞。请参阅 [安全](../../SECURITY.md)。

## 📄 许可证

MIT
