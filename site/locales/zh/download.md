# 下载 EncodeX

EncodeX **免费**，支持 Windows、Mac 和 Linux。在下面选择你的电脑类型，下载、安装，即可使用。

::: tip 始终获取最新版本
新版本发布在 [GitHub Releases 页面](https://github.com/Sandeepv68/EncodeX/releases)。下面的链接始终指向最新版——每个都附带架构、文件大小和 SHA-256 校验值，方便验证下载。
:::

<LatestDownloads />

## <OsIcon name="windows" /> Windows

**只想能用就行？** 点第一个按钮——适合绝大多数人。

<LatestDownloads platform="windows" />

**安装：** 打开下载好的文件，按屏幕提示操作。支持 Windows 10 及以上。

不知道选哪个？选推荐版——如果不匹配，Windows 会提示你。

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

## 保持更新

有新版本时，EncodeX 会在应用内提醒你，并可以自动下载并启动更新——不用再回到这个页面。

## 历史版本

需要旧版本？在下方展开对应版本即可下载——每个文件都标有大小和 SHA-256 校验值。

<LatestDownloads older />

## 需要帮助？

遇到问题或有疑问，发邮件到 **[developer@encodex.in](mailto:developer@encodex.in)** ——会有真人回复你。

## 开发者：自行构建

想从源码构建？克隆仓库并运行：

```bash
git clone https://github.com/Sandeepv68/EncodeX.git
cd EncodeX
npm install
npm run dist
```

安装包会生成在 `release/` 目录中。
