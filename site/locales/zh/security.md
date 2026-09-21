---
title: "EncodeX 安全 — 可验证、已签名、开源"
description: "EncodeX 如何保护你：开源代码、每次下载都附带 SHA-256 校验和、Windows 与 macOS 代码签名，以及可验证的更新流程。同时介绍如何报告漏洞。"
ogImage: "https://encodex.in/images/home_dashboard.webp"
---

# EncodeX 安全

EncodeX 是开源的，所以安全不必建立在信任之上——每个版本都从公开代码构建，附带**可验证的 SHA-256 校验和**，并在可行情况下**代码签名**，让你的操作系统确认它确确实实来自我们。

## 我们发布的内容，你都可以验证

- **开源。**整个应用——包括媒体处理管线与内置 FFmpeg 构建——都托管在[我们的仓库](https://github.com/Sandeepv68/EncodeX)中。任何人都可以审计应用究竟在做什么。
- **SHA-256 校验和。**每个版本都会随二进制文件发布校验和。安装前，先比对下载文件与已发布的哈希：

```bash
# Windows（PowerShell）
Get-FileHash .\EncodeX-Setup-1.0.0.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 ./EncodeX-1.0.0.dmg
```

- **代码签名。**Windows 和 macOS 版本均已签名，因此你的系统会显示「已验证的发布者」/「Apple」，而不是「未知开发者」警告。
- **可验证的更新。**应用只通过 HTTPS 下载由我们签名的更新。任何替换之前，更新签名都会在本地校验。

## 关于 macOS Gatekeeper

由于 EncodeX 免费且开源（不在 Mac App Store 销售），macOS 首次运行时可能提示「无法打开」——这是默认未签名应用要面对的 **Gatekeeper** 检查。构建是真实的；要打开它，请在「应用程序」中按住 Control 键点按该应用，选择**打开**，一次即可。之后它会正常打开。

## 内置的 FFmpeg

EncodeX 内置自己的 FFmpeg 构建，而不是调用系统二进制。确切的构建（版本、来源和配置）记录在我们的[技术架构](/zh/docs/architecture)文档中，并在 CI 中从源码复现——因此转换在各处行为一致，你运行的二进制即是我们构建的二进制。

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