# 测试

<!-- drift: test-files=323 renderer-component-tests=45 -->

## 命令

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests (matches src/**/*.integration.{test,spec}.{ts,tsx})
npm run test:integration

# E2E tests (requires build)
npm run test:e2e

# MCP-focused E2E tests (requires build)
npm run test:e2e:mcp

# Performance suites
npm run perf
```

覆盖率报告生成在 `coverage/`：

- `coverage/index.html` — 可浏览的 HTML
- `coverage/lcov.info` — 用于 IDE 集成的 LCOV 格式

## 测试套件

测试套件由 Vitest 4 运行：`src/` 下有 314 个 test/spec 文件，`e2e/` 下有 39 个 test/spec 文件，`perf/` 下有 11 个性能套件。覆盖率使用 v8 provider。实际通过数取决于平台和已安装的媒体二进制文件，因此本文档不声明固定总数。下表列出的是代表性文件，而非每个测试。

| 区域                      | 文件                                                                                                                                                                                                                                                                                                                                                                                                  | 覆盖内容                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Shared**               | `errors.test.ts`, `constants.test.ts`, `codec-containers.test.ts`, `validation.test.ts`, `types.test.ts`, `logger.test.ts`, `ipc-channels.test.ts`, `estimate.test.ts`, `video-filters.test.ts`                                                                                                                                                                                                       | 错误规范化、共享常量、编解码器/容器映射、验证辅助函数、类型契约、logger、IPC 通道注册表、滤镜、大小估算                                     |
| **Shared AI / analytics** | `shared/ai/__tests__/*`, `shared/analytics/__tests__/*`                                                                                                                                                                                                                                                                                                                                         | 与提供方无关的规划、工作流、转录/翻译、分析事件与汇总                                                                                         |
| **Main**                 | `cli.test.ts`, `index.test.ts`, `capabilities.test.ts`, `job-queue.test.ts`, `process-utils.test.ts`, `media-binaries.test.ts`, `power-actions.test.ts`, `updater.test.ts`, `updater-hostile.test.ts`, `preview-cache.test.ts`, image/video preview tests                                                                                                                                               | CLI 入口、窗口生命周期、编码器探测、队列语义、进程工具函数、媒体二进制解析、电源操作、更新逻辑                                                |
| **Main AI / analytics / monitoring / security** | `main/ai/__tests__/*`, `main/analytics/__tests__/*`, `main/monitoring/__tests__/*`, `main/security/__tests__/*`                                                                                                                                                                                                                                                                              | 提供方连接器、AI 设置、同意状态持久化、分析接线、CSP                                                                                        |
| **Main CLI**             | `cli/cli-cli.test.ts`, `cli/cli-options.test.ts`, `cli/cli-convert.test.ts`, `cli/cli-compress.test.ts`, `cli/cli-remux.test.ts`, `cli/cli-demux.test.ts`, `cli/cli-batch.test.ts`, `cli/cli-util.test.ts`, `cli/cli-integration.integration.test.ts`                                                                                                                                                 | CLI 子命令解析、选项处理、convert/compress/remux/demux 子命令、工具函数、集成测试                                                          |
| **Main IPC**             | `ipc/player.test.ts`, `ipc/image.test.ts`, `ipc/dialogs.test.ts`, `ipc/conversion.test.ts`, `ipc/window.test.ts`, `ipc/queue.test.ts`, `ipc/timeline.test.ts`, `ipc/send.test.ts`, `ipc/handlers.test.ts`, `ipc/system.test.ts`, `ipc/capabilities.test.ts`, `ipc/copilot.test.ts`, `ipc/dev.test.ts`, `ipc/channel-contract.test.ts`                                                                | 按通道的 IPC 处理器、事件广播、错误包装、系统处理器、通道契约                                                                                |
| **Main MCP**             | `mcp/gui-tools.test.ts`, `mcp/settings.test.ts`, `mcp/http-server.integration.test.ts`                                                                                                                                                                                                                                                                                                          | 内嵌 HTTP 服务器、GUI 工具、MCP 设置                                                                                                |
| **Main transcoders**     | `transcoders/ffmpeg-core.test.ts`, `transcoders/hwaccel.test.ts`, `transcoders/ffmpeg-utils.test.ts`, `transcoders/fftool-core.test.ts`, `transcoders/bmf-core.test.ts`, `transcoders/ffprobe-mapper.test.ts`, `transcoders/factory.test.ts`, `transcoders/interface.test.ts`, `transcoders/argv-contract.test.ts`, `transcoders/integration-audio.test.ts`                                                                                                                                                | 全部三个核心、硬件加速 flag 构建、ffprobe 映射、工厂分发、transcoder 接口契约                                                          |
| **Standalone MCP**       | `mcp/__tests__/server.test.ts`, `mcp/__tests__/http.test.ts`, `mcp/__tests__/mcp-stdio.integration.test.ts`, `mcp/__tests__/operations.test.ts`, `mcp/__tests__/ai-tools.test.ts`, `mcp/__tests__/safety.test.ts`, `mcp/__tests__/mcp-ui-bridge.test.ts`                                                                                                                                                                                                                                                                                                                                       | 工具/资源/提示注册、stdio 与 HTTP 传输、安全级别、MCP Apps 桥接                                                                       |
| **Main player / queue / timeline** | `player/frame-decoder.test.ts`, `queue/queue-transfer.test.ts`, `queue/persistence-recovery.test.ts`, `timeline/timeline-media.test.ts`                                                                                                                                                                                                                                                       | rawvideo 帧解码、音频管道、缓冲、队列转移与持久化、波形提取、缩略图拼图生成                                                                 |
| **Preload**              | `preload/index.test.ts`                                                                                                                                                                                                                                                                                                                                                                            | `electronAPI` 桥接的完整接口、每个 IPC 方法                                                                                            |
| **Renderer 组件**        | `VideoTimeline.test.tsx`, `MediaPlayer.test.tsx`, `CodecSelect.test.tsx`, `StreamDetails.test.tsx`, `ErrorBanner.test.tsx`, `AppDrawer.test.tsx`, `VideoFiltersSection.test.tsx`, `UpdateDialog.test.tsx`, `TermsDialog.test.tsx`, `ProfileSelector.test.tsx`, `copilot/__tests__/*`                                                                                                                 | 共享 UI 组件与 Copilot 组件的渲染、交互、错误状态、可访问性                                                                          |
| **Renderer hooks**       | `useConversion.test.tsx`, `useErrorHandler.test.ts`, `useFormErrors.test.ts`, `useMediaTask.test.ts`, `useLanguageDirection.test.tsx`, `useHotkeys.test.tsx`, `useOnlineStatus.test.ts`                                                                                                                                                                                                          | 转换编排、错误处理、表单校验、媒体任务生命周期、RTL 方向、键盘快捷键、在线状态                                                              |
| **Renderer 页面**        | `VideoCut.test.tsx`, `Convert.test.tsx`, `ImageCompress.test.tsx`, `AudioExtract.test.tsx`, `Settings.test.tsx`, `BatchQueue.test.tsx`, `Logs.test.tsx`, `MediaInfo.test.tsx`, `Dashboard.test.tsx`, `About.test.tsx`, `Remux.test.tsx`, `Demux.test.tsx`                                                                                                                                             | 完整页面流程：表单状态、校验、IPC 调用、设置持久化、remux/demux、关于/更新                                                              |
| **Renderer store**       | `conversionStore.test.ts`, `audioExtractStore.test.ts`, `settingsStore.test.ts`, `errorStore.test.ts`, `queueStore.test.ts`, `toastStore.test.ts`, `logStore.test.ts`, `videoCutStore.test.ts`, `remuxStore.test.ts`, `demuxStore.test.ts`, `copilotChats.test.ts`, `aiSettingsStore.test.ts`, `aiConnectionStore.test.ts`, `profileStore.test.ts`, `termsStore.test.ts`, `auditStore.test.ts`, `updateStore.test.ts`                                                                                    | Zustand store 的状态转换与持久化                                                                                                       |
| **Renderer 工具函数**    | `formatters.test.ts`, `lunar-calendar.test.ts`, `easter-egg-dates.test.ts`, `batch-options.test.ts`, `queue-reorder.test.ts`, `security-utils.test.ts`                                                                                                                                                                                                                                          | 格式化辅助函数、彩蛋日期、批量选项、队列重排逻辑、安全辅助函数                                                                            |
| **Renderer 应用 / 其他** | `App.test.tsx`, `colors.test.ts`, `sessionCleanup.test.ts`, `constants/shortcuts.test.ts`, `Copilot.test.tsx`, `copilot-components.test.tsx`, `axe-all-pages.test.tsx`, `i18n-matrix.test.tsx`, `keyboard-shell.test.tsx`                                                                                                                                                                       | 应用外壳路由、调色板、会话清理、键盘快捷键、Copilot UI、可访问性与 i18n 矩阵                                                               |
| **集成**                 | `error-flow.test.ts`, 恶意 IPC/桥接测试                                                                                                                                                                                                                                                                                                                                                             | 完整管道：Error -> `formatError` -> store -> 展示 -> 清理；恶意输入处理                                                              |

## 测试配置

测试环境（`src/test-setup.ts`）提供：

- `react-i18next` 的 `useTranslation` mock，带键名到英文的映射和插值
- `globalThis` 上覆盖所有 IPC 方法的 `electronAPI` mock
- 注册 `@testing-library/jest-dom/vitest` 匹配器

## E2E 测试

端到端测试位于 `e2e/` 中，通过 Vitest 运行（node 环境，60 秒超时），并使用 Playwright 的 Electron 自动化驱动打包后的应用。测试规格位于 `e2e/specs/`，MCP 规格位于 `e2e/mcp/`，CLI 规格位于 `e2e/cli.spec.ts`；共运行 39 个测试/规格文件。它们以环境变量 `E2E` 或 CI 为条件启用：

| 文件                 | 覆盖内容                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `e2e/cli.spec.ts` | CLI 模式：`--help`/`-h`、子命令（`convert`、`info`、`capabilities`、`compress`、`extract-audio`、`remux`、`demux`、`batch`）、遗留扁平语法、全局标志（`--quiet`、`--no-color`、`--theme`） |
| `e2e/mcp/*.spec.ts` | MCP stdio/HTTP 传输、内嵌 GUI 服务器、MCP Apps UI，以及 VS Code 客户端/UI 集成                |
| `e2e/specs/settings-mcp.spec.ts`、`settings-ai.spec.ts` | 内嵌 MCP 设置与 AI 提供方设置                                                    |
| `e2e/specs/remux-demux-filters.spec.ts`、`copilot*.spec.ts`、`profiles.spec.ts`、`terms-gate.spec.ts` | Remux/demux、视频滤镜、Copilot 规划与已保存对话、配置文件、条款门控 |
| `e2e/specs/shell.spec.ts` | 应用外壳：窗口标题、`electronAPI` 存在性、全部导航路由、抽屉导航、窗口控件、语言菜单                  |
| `e2e/specs/convert.spec.ts` | Convert 页面：文件选择、输出自动补全、编解码器/比特率/缩放/像素/transcoder 选项、无损复制、带进度的转换、暂停/恢复、取消 |
| `e2e/specs/batch.spec.ts` | 批处理队列：空状态、通过审阅对话框添加文件、队列事件、实时进度、全部取消、状态过滤、移除任务、拖拽重排、窗口关闭确认 |
| `e2e/specs/audio-extract.spec.ts` | 音频提取：禁用按钮、选择含音频流的视频、编解码器/比特率切换、提取并显示成功 toast          |
| `e2e/specs/image-compress.spec.ts` | 图像压缩：放置区、选择图像并显示预览、格式/质量/缩放切换、压缩并显示成功 toast              |
| `e2e/specs/media-info.spec.ts` | 媒体信息：视频分析（流、编解码器详情）、图像分析（EXIF 数据）                                   |
| `e2e/specs/settings.spec.ts` | 设置：主题卡片、主题切换、置顶、开机自启、hwaccel 模式持久化                                    |
| `e2e/specs/logs.spec.ts` | 日志：条目输出、级别过滤、清空全部、下载并显示 toast                                            |
| `e2e/specs/video-cut.spec.ts` | 视频剪切：禁用按钮、时间线 + 波形 + 缩略图、时长/结束时间切换、播放头拖动、带进度的剪切、取消、表单重置 |
| `e2e/specs/real-convert.spec.ts` | Tier B（真实）：无 mock 的真实 FFmpeg 转换（以 `E2E_REAL=1` 为条件）                          |
