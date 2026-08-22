# 下载 EncodeX

EncodeX **免费**，支持 Windows、Mac 和 Linux。在下面选择你的电脑类型，下载、安装，即可使用。

::: tip 始终获取最新版本
新版本发布在 [GitHub Releases 页面](https://github.com/Sandeepv68/EncodeX/releases)。下面的链接始终指向最新版。
:::

## <OsIcon name="windows" /> Windows

**只想能用就行？** 点第一个按钮——适合绝大多数人。

| | 下载 | 适用 |
|---|---------|-----|
| ✅ **推荐** | [下载 Windows 版](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x64-setup.exe) | 大多数台式机和笔记本（64 位） |
| 老旧 32 位电脑 | [32 位版本](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-ia32-setup.exe) | 非常老的机器 |
| ARM 笔记本 | [ARM 版本](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64-setup.exe) | 搭载骁龙的 Windows 笔记本 |

**安装：** 打开下载好的文件，按屏幕提示操作。支持 Windows 10 及以上。

不知道选哪个？选推荐版——如果不匹配，Windows 会提示你。

## <OsIcon name="apple" /> Mac

| | 下载 | 适用 |
|---|---------|-----|
| 较新的 Mac（2021 年及以后） | [下载 Apple Silicon 版](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64.dmg) | M1、M2、M3、M4 芯片 |
| 较旧的 Mac | [下载 Intel 版](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x64.dmg) | 2021 年之前的 Mac |

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

| | 下载 | 适用 |
|---|---------|-----|
| ✅ **推荐** | [下载 AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-x86_64.AppImage) | 大多数 Linux 电脑（64 位） |
| ARM64 | [ARM64 AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-arm64.AppImage) | ARM 开发板和笔记本 |
| ARMv7 | [ARMv7 AppImage](https://github.com/Sandeepv68/EncodeX/releases/latest/download/EncodeX-1.0.0-beta.0-armv7l.AppImage) | 较老的单板计算机 |

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
