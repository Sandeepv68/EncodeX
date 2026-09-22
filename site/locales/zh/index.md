---
layout: home
title: "EncodeX — 免费 FFmpeg 视频转换器，适用于 Windows、Mac 和 Linux"
description: "EncodeX 是一款适用于 Windows、macOS 和 Linux 的免费开源 FFmpeg 图形界面。您可以转换视频和音频、压缩文件、裁剪片段、提取音乐——全程在您的电脑上完成，无需命令行。内置 MCP 服务器，专为 AI 助手打造。"
ogImage: "https://encodex.in/images/home_dashboard.webp"

hero:
  name: EncodeX<br>免费开源 · Windows · macOS · Linux
  text: FFmpeg 的强大能力。无需命令行。
  tagline: 一款免费、开源的智能多媒体转换器，适用于 Windows、macOS 和 Linux。转换视频、提取音频、剪辑片段、压缩文件——一切都在本地完成，文件不会离开您的电脑。现在，通过 MCP，Claude、Cursor 或 VS Code 等 AI 助手可以用自然语言驱动同一引擎。
  image:
    src: /images/home_dashboard.webp
    alt: EncodeX 主界面，已加载视频并选中 YouTube 1080p 配置文件
  actions:
    - theme: brand
      text: 下载 EncodeX — 免费且开源
      link: /zh/download
    - theme: alt
      text: 在 GitHub 上查看 →
      link: https://github.com/Sandeepv68/EncodeX

---

<div class="trust-strip">
  <span>永远免费</span>
  <span>无需账号</span>
  <span>无水印</span>
  <span>100% 本地</span>
  <span>🤖 内置 MCP</span>
</div>

## 把重活交给 AI

AI 助手现在可以操作您的本地媒体工具箱。让 Claude、Cursor 或 VS Code 转换视频、提取音频或压缩一整个文件夹的照片——所有工作都在您的电脑上通过 EncodeX 完成。

<McpDemo />

<div class="card-grid two-col">
  <div class="card">
    <span class="card-emoji">🧠</span>
    <p class="card-head">用大白话直接说</p>
    <p>"把它转成 MP4 再压小一点发邮件。"你的助手会选对工具、通过 EncodeX 执行，然后把结果交还给你。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🔒</span>
    <p class="card-head">依然是 100% 本地</p>
    <p>MCP 服务器只监听 localhost，绝不会上传你的媒体。和 GUI 一样，文件始终留在你的电脑上。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🧩</span>
    <p class="card-head">兼容你的助手</p>
    <p>Claude Desktop、Claude Code、Cursor、VS Code 或任何兼容 MCP 的客户端。运行 <code>encodex --mcp</code>，或在应用打开时到设置里开启内置服务器。</p>
  </div>
  <div class="card">
    <span class="card-emoji">⚙️</span>
    <p class="card-head">真正的自动化</p>
    <p>19 个工具覆盖转换、音频提取、图片压缩、媒体信息、批量任务、预览和更新——让 Agent 可以串联起真正的工作。</p>
  </div>
</div>

<p><a href="/zh/mcp">探索 MCP 服务器 →</a> · <a href="/zh/docs/cli#mcp-server-mode">阅读 MCP 服务器文档 →</a></p>

## 它能帮你做什么

告诉 EncodeX 你想做什么，技术细节交给它。

<div class="card-grid three-col">
  <div class="card">
    <span class="card-emoji">🎬</span>
    <p class="card-head">什么都能转，随处都能播</p>
    <p>MP4、MKV、AVI、MOV、WebM 等。选好您要在哪个设备上看，格式的事交给 EncodeX。</p>
    <p><a href="/zh/video-converter">视频转换器 →</a></p>
  </div>
  <div class="card">
    <span class="card-emoji">📦</span>
    <p class="card-head">把大文件变小</p>
    <p>更小的 MP4 和 MKV，能塞进邮件、聊天和上传限制——几乎看不出差别。</p>
    <p><a href="/zh/video-compressor">视频压缩器 →</a></p>
  </div>
  <div class="card">
    <span class="card-emoji">✂️</span>
    <p class="card-head">只保留精彩部分</p>
    <p>剪到你想要的精确时刻。会拖滑块，就会剪视频。</p>
    <p><a href="/zh/use-cases">查看使用场景 →</a></p>
  </div>
  <div class="card">
    <span class="card-emoji">🎧</span>
    <p class="card-head">把视频变成音乐</p>
    <p>从任何视频中提取 MP3、M4A、FLAC 或 WAV——课程、访谈、演唱会。</p>
    <p><a href="/zh/audio-converter">音频转换器 →</a></p>
  </div>
  <div class="card">
    <span class="card-emoji">🗂️</span>
    <p class="card-head">整个文件夹一次搞定</p>
    <p>丢进 50 个文件就走人。EncodeX 逐个处理——完成后还能自动关机。</p>
    <p><a href="/zh/features">全部功能 →</a></p>
  </div>
  <div class="card">
    <span class="card-emoji">🖼️</span>
    <p class="card-head">修正并瘦身图片</p>
    <p>缩小照片方便分享，旋转侧拍的画面——只要格式不变就无损。</p>
    <p><a href="/zh/features">全部功能 →</a></p>
  </div>
</div>

## 一个简单窗口，搞定一切

没什么要学的。四个步骤，从头到尾：

<div class="workflow-steps">
  <div class="wf-step">
    <span class="wf-num">1</span>
    <p class="card-head">拖入</p>
    <p>把 <code>vacation.mkv</code> 拖进窗口。</p>
  </div>
  <div class="wf-step">
    <span class="wf-num">2</span>
    <p class="card-head">选目标</p>
    <p>选 📱 手机——EncodeX 自动选择 MP4 1080p。</p>
  </div>
  <div class="wf-step">
    <span class="wf-num">3</span>
    <p class="card-head">开始转换</p>
    <p>EncodeX 为你运行 FFmpeg，并调用显卡加速。</p>
  </div>
  <div class="wf-step">
    <span class="wf-num">4</span>
    <p class="card-head">完成</p>
    <p><code>vacation.mp4</code> 就在你放的位置。</p>
  </div>
</div>

<div class="privacy-band">
  <h2>您的视频永远不会离开您的电脑。</h2>
  <p>EncodeX 使用内置的 FFmpeg 引擎在本地处理您的媒体。不上传、不追踪、不存储到任何服务器。</p>
  <ul class="checklist">
    <li>✅ 无云端上传</li>
    <li>✅ 无需注册账号</li>
    <li>✅ 无需订阅</li>
    <li>✅ 无水印</li>
    <li>✅ 无文件大小限制</li>
    <li>✅ 可离线使用</li>
  </ul>
  <p><a href="/zh/privacy">了解 EncodeX 如何保护你的隐私 →</a> · <a href="/zh/security">了解版本如何签名与校验 →</a></p>
</div>

## 选目标，而不是选编码

140 多个内置配置文件替你完成设置。你只要说出你想要什么。

<div class="card-grid three-col">
  <div class="card">
    <p class="card-head">📱 手机</p>
    <p>到处都能播放的小巧 MP4。</p>
    <p><a href="/zh/video-converter">MP4 →</a></p>
  </div>
  <div class="card">
    <p class="card-head">▶️ YouTube</p>
    <p>1080p MP4，可直接上传。</p>
    <p><a href="/zh/features">YouTube 配置文件 →</a></p>
  </div>
  <div class="card">
    <p class="card-head">📸 Instagram Reels</p>
    <p>正确比例的竖屏 H.264。</p>
    <p><a href="/zh/features">Reels 配置文件 →</a></p>
  </div>
  <div class="card">
    <p class="card-head">💬 WhatsApp</p>
    <p>发送快速的精简 MP4。</p>
    <p><a href="/zh/compress/mp4">压缩 MP4 →</a></p>
  </div>
  <div class="card">
    <p class="card-head">📧 邮件</p>
    <p>不超大小限制的小巧 MP4。</p>
    <p><a href="/zh/compress/mp4">压缩 MP4 →</a></p>
  </div>
  <div class="card">
    <p class="card-head">🎬 视频剪辑</p>
    <p>专业工作流的 ProRes 422。</p>
    <p><a href="/zh/codecs/prores">ProRes →</a></p>
  </div>
</div>

> **你不需要懂编码格式。只要选好你要干什么。**

## 是不是很眼熟？

你不是一个人。这些都是 EncodeX 能解决的日常问题：

<div class="card-grid three-col">
  <div class="card">
    <span class="card-emoji">📱</span>
    <p class="card-head">"这个视频在我手机上放不了！"</p>
    <p>相机、朋友或网站发来的文件，设备却不认识。EncodeX 把它翻译成到处都能播放的格式。</p>
  </div>
  <div class="card">
    <span class="card-emoji">📧</span>
    <p class="card-head">"文件太大，发不出去。"</p>
    <p>邮箱和聊天软件都有大小限制。EncodeX 把文件压到能发送为止，画面几乎看不出差别。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🎵</span>
    <p class="card-head">"我只要这个视频里的声音。"</p>
    <p>一节课、一段访谈、一首演唱会现场。EncodeX 抽出音频，交给你一个音乐文件。</p>
  </div>
  <div class="card">
    <span class="card-emoji">⏱️</span>
    <p class="card-head">"视频有 40 分钟，我只要 2 分钟。"</p>
    <p>几秒剪好。不用学剪辑：会拖滑块就会用。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🗂️</span>
    <p class="card-head">"有 50 个文件要转，难道一个一个来？！"</p>
    <p>直接把整个文件夹拖进来。EncodeX 会自动排队，逐个处理，不用你盯着。</p>
  </div>
  <div class="card">
    <span class="card-emoji">😩</span>
    <p class="card-head">"别的软件连这都要订阅费？"</p>
    <p>EncodeX 是真免费。没账号、没订阅、文件上也没水印。</p>
  </div>
</div>

## 为什么选择 EncodeX？

::: tip 🆓 免费开源（MIT）
EncodeX **永远完全免费**——无需账号、无需订阅，也没有藏着好东西的付费档。它是由志愿者社区打造的开源软件（MIT 许可证）。 <a href="https://github.com/Sandeepv68/EncodeX">在 GitHub 上查看源码 →</a> · <a href="https://github.com/Sandeepv68/EncodeX/blob/main/LICENSE">MIT 许可证</a>
:::

<div class="card-grid three-col">
  <div class="card">
    <span class="card-emoji">🔒</span>
    <p class="card-head">隐私保护</p>
    <p>一切都在你自己的电脑上进行，永远不会上传任何东西。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🆓</span>
    <p class="card-head">免费且开源</p>
    <p>MIT 许可证。没有订阅、没有账号、没有藏着好东西的付费档。</p>
  </div>
  <div class="card">
    <span class="card-emoji">⚡</span>
    <p class="card-head">硬件加速</p>
    <p>自动调用你的显卡芯片，让转换快得多。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🌎</span>
    <p class="card-head">35+ 种语言</p>
    <p>包括阿拉伯语、希伯来语等从右到左的书写系统——每个界面都有翻译。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🚫</span>
    <p class="card-head">没有水印</p>
    <p>转换出来的文件干干净净，不带任何 logo。</p>
  </div>
  <div class="card">
    <span class="card-emoji">📴</span>
    <p class="card-head">离线可用</p>
    <p>无需联网。你需要的一切都随应用自带。</p>
  </div>
</div>

## 新手友好，开发者强大。

EncodeX 有三重身份。日常任务用**拖放式界面**，需要脚本时用**命令行模式**进行脚本化与自动化，或者通过内置的 MCP 服务器连接 **AI 助手**。

<div class="card-grid three-col">
  <div class="card">
    <span class="card-emoji">🖱️</span>
    <p class="card-head">图形界面</p>
    <p>拖入 → 设置 → 转换。在同一个干净窗口里完成转换、压缩、剪辑和提取——无需命令，无需折腾。</p>
  </div>
  <div class="card">
    <span class="card-emoji">⌨️</span>
    <p class="card-head">命令行 CLI</p>
    <p>脚本 → 自动化 → 批量处理。同一个引擎，命令行控制：<code>encodex convert</code>、<code>encodex batch</code>、<code>encodex info</code> 等。 <a href="/zh/cli">探索 CLI →</a></p>
  </div>
  <div class="card">
    <span class="card-emoji">🤖</span>
    <p class="card-head">MCP 服务器</p>
    <p>提问 → 自动化 → 集成。让 Claude、Cursor、VS Code 和自定义 Agent 驱动同一个引擎。 <a href="/zh/docs/cli#mcp-server-mode">探索 MCP →</a></p>
  </div>
</div>

<div class="card-grid three-col">
  <div class="card">
    <span class="card-emoji">⚡</span>
    <p class="card-head">GPU 加速</p>
    <p>在 NVIDIA、AMD、Intel 和 Apple Silicon 上自动获得更快的编码。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🎛️</span>
    <p class="card-head">140+ 现成配置文件</p>
    <p>YouTube、Instagram、TikTok、Apple 设备、ProRes、HLS 等。选一个，设置自动填好。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🌀</span>
    <p class="card-head">旋转并修正侧拍画面</p>
    <p>90°、180° 或 270°，外加镜像——只要保持 MP4/MOV/MKV 就无损。</p>
  </div>
</div>

## 适合谁用？

<div class="card-grid three-col">
  <div class="card">
    <span class="card-emoji">👨‍👩‍👧</span>
    <p class="card-head">家庭用户</p>
    <p>让家庭录像能在电视上播放，分享前先把照片压小一点。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🎓</span>
    <p class="card-head">学生党</p>
    <p>把录课转成音频笔记，剪短冗长的录音。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🎥</span>
    <p class="card-head">内容创作者</p>
    <p>把片段转成正确格式、切出高光时刻、抽取音效。</p>
  </div>
  <div class="card">
    <span class="card-emoji">💼</span>
    <p class="card-head">办公族</p>
    <p>晚上批量转换培训视频和塞满素材的文件夹。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🎙️</span>
    <p class="card-head">播客主播</p>
    <p>把视频录像变成干净的音频文件，按发布平台需要的大小和格式导出。</p>
  </div>
  <div class="card">
    <span class="card-emoji">🧓</span>
    <p class="card-head">以及所有人</p>
    <p>"文件格式"听起来像天书？这款应用就是为你做的。</p>
  </div>
</div>

## 热门工具与指南

深入某个具体任务——每页都说明如何用 EncodeX 完成：

<div class="card-grid three-col">
  <div class="card">
    <p class="card-head"><a href="/zh/ffmpeg-gui">FFmpeg GUI</a></p>
    <p>FFmpeg 引擎的友好界面——无需任何命令。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/handbrake-alternative">HandBrake 替代方案</a></p>
    <p>EncodeX 与 HandBrake、FFmpeg CLI、Shutter Encoder 的对比。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/video-converter">视频转换器</a></p>
    <p>在 Windows、Mac 和 Linux 上于所有格式之间转换视频。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/video-compressor">视频压缩器</a></p>
    <p>保持画质地缩小体积——支持 MP4、MKV 等。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/audio-converter">音频转换器</a></p>
    <p>转换 MP3、FLAC、WAV 等格式，或从视频提取音频。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/extract-audio-from-video">从视频中提取音频</a></p>
    <p>几下点击即可把任意视频变成 MP3、M4A、FLAC 或 WAV。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/mkv-to-mp4">MKV 转 MP4</a></p>
    <p>通过转换为 MP4，让 MKV 视频随处可播。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/codecs/h264">H.264</a></p>
    <p>使用世界上兼容性最广的视频编解码器编码。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/codecs/h265">H.265 / HEVC</a></p>
    <p>画质相近时，文件大小约为 H.264 的一半。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/learn/what-is-ffmpeg">什么是 FFmpeg？</a></p>
    <p>EncodeX 内部引擎的通俗指南。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/learn/what-format-to-use">该选什么格式？</a></p>
    <p>MP4、MKV、H.264、HEVC 或 AV1 — 按目标选择。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/mp4-to-mkv">MP4 转 MKV</a></p>
    <p>无损、即时重新封装 MP4 为 MKV，字幕完整保留。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/mp4-to-webm">MP4 转 WebM</a></p>
    <p>转换为网页原生格式，文件更小、更快。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/codecs/vp9">VP9</a></p>
    <p>开放、免专利费，压缩率出色的编码器。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/codecs/prores">ProRes</a></p>
    <p>电影人使用的专业剪辑编码格式。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/compress/mp4">压缩 MP4</a></p>
    <p>缩小 MP4 视频以适配邮件、聊天和上传限制。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/compress/mkv">压缩 MKV</a></p>
    <p>压缩 MKV 文件，便于存储和分享。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/avi-to-mp4">AVI 转 MP4</a></p>
    <p>让 AVI 视频在手机、电视和网页上都能播放。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/mov-to-mp4">MOV 转 MP4</a></p>
    <p>把 Apple 的 MOV 文件转成任何设备和应用都能播放。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/mkv-to-webm">MKV 转 WebM</a></p>
    <p>转为网页原生格式，文件更小、加载更快。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/webm-to-mp4">WebM 转 MP4</a></p>
    <p>把 WebM 视频转成 MP4，随处都能播放。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/mkv-to-mp3">MKV 转 MP3</a></p>
    <p>把 MKV 里的音轨单独提取成 MP3。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/mov-to-mp3">MOV 转 MP3</a></p>
    <p>把 MOV 视频中的音频提取为干净的 MP3。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/mp4-to-mp3">MP4 转 MP3</a></p>
    <p>把 MP4 视频转成纯音频 MP3。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/flv-to-mp4">FLV 转 MP4</a></p>
    <p>把 Flash 时代的 FLV 视频转成通用 MP4。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/flv-to-mkv">FLV 转 MKV</a></p>
    <p>把 FLV 视频放进现代灵活的 MKV 容器。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/m4v-to-mp4">M4V 转 MP4</a></p>
    <p>让 iTunes 和 Apple 视频文件在任意设备播放。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/wmv-to-mp4">WMV 转 MP4</a></p>
    <p>转换 WMV 视频，适合手机、电视和网上分享。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/wmv-to-mkv">WMV 转 MKV</a></p>
    <p>把 Windows Media 的 WMV 文件封装进 MKV 容器。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/avi-to-mkv">AVI 转 MKV</a></p>
    <p>把 AVI 封装进灵活功能丰富的 MKV 容器。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/mov-to-mkv">MOV 转 MKV</a></p>
    <p>把 Apple MOV 视频转换到 MKV 容器。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/convert/webm-to-mkv">WebM 转 MKV</a></p>
    <p>把 WebM 转成 MKV，支持字幕和多音轨。</p>
  </div>
  <div class="card">
    <p class="card-head"><a href="/zh/extract/mp3-from-video">提取 MP3</a></p>
    <p>从任何视频中提取 MP3 配乐或播客。</p>
  </div>
</div>

<OpenSourceCard />

<div class="cta-card">
  <h2>准备好试试了吗？</h2>
  <p>安装大约两分钟，而且永远免费。</p>
  <p><strong><a href="/zh/download">⬇️ 立即下载 EncodeX</a></strong> · <a href="/zh/features">浏览完整介绍</a></p>
</div>