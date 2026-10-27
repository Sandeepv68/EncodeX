---
title: "EncodeX 安全 — 开源、校验和与漏洞报告"
description: "EncodeX 如何保护你：开源代码、每个版本发布的 SHA-256 校验和、更新时基于 GitHub 摘要的检查，以及如何报告漏洞。发布版本未经代码签名。"
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# EncodeX 安全

EncodeX 是开源的，所以安全不必建立在信任之上。每个版本都从公开代码构建，并发布 **SHA-256 校验和** 供你比对下载文件。发布版本**未进行代码签名**，因此操作系统可能会显示「未知开发者」或「无法验证开发者」警告。

## 我们发布的内容，你都可以验证

- **开源。**整个应用——包括媒体处理管线与发布脚本——都托管在[我们的仓库](https://github.com/Sandeepv68/EncodeX)中。任何人都可以审计应用究竟在做什么。
- **SHA-256 校验和。**每个版本都会发布 `SHA256SUMS.txt` 文件，与二进制文件一同提供。

```bash
# Windows（PowerShell）
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **可验证的更新。**更新程序检查 GitHub Releases。当 GitHub 为更新文件提供 SHA-256 或 SHA-512 摘要时，应用会据此校验下载内容。更新程序不验证加密签名。更新绝不会自动安装，由你决定何时安装。

## 关于 macOS Gatekeeper

由于 EncodeX 免费且开源，不通过 Mac App Store 销售，并且其 macOS 构建未经代码签名或公证，macOS 首次运行时可能提示「无法打开」。构建即发布页面上提供的版本。要打开它，请在「应用程序」中按住 Control 键点按该应用，选择**打开**，一次即可。在较新的 macOS 版本上，你可能需要使用「系统设置 → 隐私与安全性 → 仍要打开」。

## 内置的 FFmpeg

EncodeX 附带预构建的 FFmpeg 和 FFprobe 二进制文件（来自 `ffmpeg-static` 和 `ffprobe-static` 包），而不是调用系统二进制。转换以本地子进程方式在您的设备上运行。引擎如何接入，请参阅我们的[技术架构](/zh/docs/architecture)。

## 报告漏洞

我们认真对待安全问题，并遵循简单的披露流程：

1. **不要**在公开的 GitHub issues 中报告漏洞——那会在我们修复之前暴露缺陷。
2. 在仓库中新建一个**[私有安全公告](https://github.com/Sandeepv68/EncodeX/security/advisories/new)**。
3. 我们会在 **48 小时内**确认收到，并提供预计修复时间。安全修复会优先处理并尽快发布。

其他问题请使用[常规问题跟踪](https://github.com/Sandeepv68/EncodeX/issues)。

## 开始使用

- [免费下载 EncodeX](/zh/download)
- [阅读隐私政策](/zh/privacy)
- [技术架构与内置 FFmpeg](/zh/docs/architecture)