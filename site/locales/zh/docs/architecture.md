# 架构

EncodeX 是一款基于 FFmpeg、React、TypeScript 和 Electron 构建的跨平台多媒体转换工具。它面向希望在参与贡献之前先了解各部分如何协同工作的开发者。

<p align="center"><img src="/images/architecture.png" alt="EncodeX architecture" width="1024" height="1024" loading="lazy" /></p>

## 设计原则

renderer 从不启动进程，也从不直接访问文件系统。所有特权操作（文件对话框、FFmpeg 执行、探测、窗口控制）都位于主进程中，并通过 IPC 访问。

- **三进程分离** — main、preload 与 renderer，遵循 Electron 的安全模型（`contextIsolation: true`、`nodeIntegration: false`）。
- **对媒体后端的单一抽象** — `ITranscoder` 接口隐藏了转换究竟是由 `fluent-ffmpeg` 驱动、由原始的 FFmpeg CLI 子进程驱动，还是由 BMF 框架驱动。
- **IPC 作为类型化契约** — 每个通道都是 `src/shared/ipc-channels.ts` 中的一个常量，renderer 只通过 preload 脚本暴露的 `window.electronAPI` 桥接与主进程通信。
- **共享类型与常量** — 三个进程都会导入 `src/shared/`，使接口在构造上保持同步。
- **UI 的渐进增强** — 页面通过 `React.lazy` 进行代码分割，状态保存在 Zustand store 中，长时间运行的任务通过 IPC 事件流式回传进度。

## 深入解析

完整的架构拆分为多个聚焦文档：

| 文档 | 主题 |
|----------|--------|
| [进程、构建系统与启动](/zh/docs/architecture-processes) | 进程模型（main/preload/renderer/shared）、构建系统、二进制解析、启动序列、CLI 模式、共享代码层 |
| [Transcoder 抽象与转换](/zh/docs/architecture-transcoders) | `ITranscoder` 接口、FfmpegCore / FFToolCore / BmfCore、共享 flag 构建、硬件加速、媒体探测、转换流程 |
| [Renderer、状态与子系统](/zh/docs/architecture-renderer) | 渲染树、页面、hooks、Zustand store、批处理队列、视频播放器、时间线媒体、图像处理、错误处理、日志、i18n、主题、数据流参考 |

## 其他文档

| 文档 | 主题 |
|----------|--------|
| [功能参考](/zh/docs/features-reference) | 功能、支持的媒体格式、编解码器表、验证工具 |
| [CLI 用法](/zh/docs/cli) | CLI 用法、子命令、全部选项表 |
| [IPC 通道](/zh/docs/ipc) | IPC 通道（请求/仅发送/事件）、electronAPI 桥接 |
| [测试](/zh/docs/testing) | 测试套件（123 个文件、1603 个测试）、测试配置、E2E 规格 |
| [项目结构](/zh/docs/project-structure) | 完整目录树及注释 |
| [更新管理器](/zh/docs/update-manager) | 应用内更新管理器的实现 |

## 仓库

完整的事实来源存放在仓库的 [`docs/` 目录](https://github.com/Sandeepv68/EncodeX/tree/main/docs)。项目概览、安装步骤和贡献指南请参见 [GitHub 上的 README](https://github.com/Sandeepv68/EncodeX)。
