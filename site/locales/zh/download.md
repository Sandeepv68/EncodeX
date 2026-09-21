# 下载 EncodeX

EncodeX **免费**，支持 Windows、Mac 和 Linux。一款开源 FFmpeg 图形界面——无需账号、无水印、无文件大小限制——一切都在本地完成。

::: tip 第一次来？接下来会发生什么
安装应用，把一个视频或图片拖进窗口，选择一个配置（如 MP4 或“更小文件”），然后点击 **转换**——就完成了。所有操作都在你的电脑上本地完成。

- **第一次使用 EncodeX？** 查看[可以做什么的示例](/zh/use-cases)，或[浏览所有工具](/zh/features)。
- **卡住了？** 大多数转换只需要拖入一个文件 + 点击一个配置。仪表盘上的“快速上手”卡片会引导你选择目标。
:::

## <OsIcon name="windows" /> Windows

**Windows 10/11 · 64 位**——适合绝大多数人。

<LatestDownloads platform="windows" />

**安装：** 打开下载好的文件，按屏幕提示操作。

不知道选哪个？选推荐版——如果不匹配，Windows 会提示你。

### 其他平台

[macOS](#mac) · [Linux](#linux) · [Windows ARM64](#windows) · [Windows 32 位](#windows)

## <OsIcon name="apple" /> Mac

<LatestDownloads platform="macos" />

**安装：** 打开下载的 `.dmg` 文件，把 EncodeX 拖进"应用程序"文件夹。

**不确定自己的 Mac 是哪种？** 点击屏幕左上角的苹果图标（<OsIcon name="apple" label="苹果标志" />），选择"关于本机"，查看"芯片"一行。如果显示"Apple M1"（或 M2/M3/M4），选 Apple Silicon；如果显示"Intel"，选 Intel 版。

::: warning Mac 上首次启动——多一步操作
由于 EncodeX 免费且开源（不在 Mac App Store 上架），macOS 首次打开时可能提示应用"无法打开"。这很正常，这样解决：

1. 在"应用程序"文件夹里找到 EncodeX
2. 按住 **Control** 键点击该应用，选择**打开**
3. 在弹出的窗口中再点一次**打开**

只需做一次——之后就能正常打开了。
:::

## <OsIcon name="linux" /> Linux

<LatestDownloads platform="linux" />

**运行：** AppImage 是单个文件——无需安装。加上可执行权限后双击即可：

```bash
chmod +x EncodeX-*.AppImage
./EncodeX-*.AppImage
```

（许多桌面环境也可以不碰终端：右键文件 → 属性 → 允许执行，然后双击。）

## 对电脑的要求

没什么特别要求——只要电脑是近几年买的就没问题：

- **操作系统：** Windows 10+、macOS 11+ 或较新的 Linux
- **磁盘空间：** 约 400 MB（应用自带全部依赖——无需额外下载）
- **内存：** 正常配置即可

> **为什么 EncodeX 约 400 MB？**
> EncodeX 内置 FFmpeg 引擎和全部受支持的组件，因此你无需单独安装 FFmpeg、编解码器或任何其他内容——以后也不用额外下载。没有任何文件被上传，也没有云端运行：[所有转换都在你的电脑上本地进行](/zh/features)。

## 保持更新

有新版本时，EncodeX 会在应用内提醒你，并可以自动下载并启动更新——不用再回到这个页面。

## 历史版本

需要旧版本？在下方展开对应版本即可下载——每个文件都标有大小和 SHA-256 校验值。

<LatestDownloads older />

## 需要帮助？

遇到问题或有疑问，发邮件到 **[developer@encodex.in](mailto:developer@encodex.in)** ——会有真人回复你。

## 隐私

我们理解信任的重要性。每次转换都在你的电脑上进行——你的文件绝不会被上传、追踪或存储在服务器上。阅读[完整隐私政策](/zh/privacy)。

## 安全

每个版本都附带[可验证的 SHA-256 校验和与已签名构建](/zh/security)——如果发现问题，也可以私下报告。详见[安全页面](/zh/security)。

## 开发者：自行构建

想从源码构建？克隆仓库并运行：

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

安装包会生成在 `release/` 目录中。
