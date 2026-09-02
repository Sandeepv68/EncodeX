# EncodeX 能做什么？

EncodeX 是一款免费的电脑应用，几次点击就能解决常见的文件问题：

- **转换视频格式**，让它在任何设备上播放
- **提取视频中的音频**，保存为 MP3
- **裁剪视频**，只留下需要的部分
- **压缩照片**，方便发送和上传

支持 Windows、Mac 和 Linux，完全免费，提供 35 种以上语言。

---

## 转换视频和音频格式

<img src="/images/convert.webp" alt="媒体转换" width="1600" height="1057" loading="lazy">

**问题：** 别人发来一个视频，手机、电视或剪辑软件都打不开。

**解决：** 把文件拖进 EncodeX，选择要在哪里播放（或者直接选 MP4 这个稳妥选项），点"转换"。就这么简单。

几乎可以在所有常见视频和音频格式之间转换：MP4、MKV、AVI、MOV、WebM、MP3、WAV、FLAC 等等。不知道选什么？默认设置就是最好的起点。

## 选个配置文件，直接开始

不想折腾设置？EncodeX 内置了 140 多个转换配置文件——每一个都是针对特定用途精心调校的预设。想导出一个 1080p 的 YouTube 视频？有对应的配置文件。Instagram Reel 需要正确格式？一键搞定。视频编辑器需要 ProRes？已覆盖。

配置文件分为 8 个类别：Web 与社交（YouTube、Instagram、TikTok、Facebook、X）、设备（Apple、Android、游戏主机）、视频编解码器、专业（ProRes、DNxHD/HR）、流媒体（HLS、DASH）、音频、图片和高级。选择一个，所有正确的设置就会自动填入——编解码器、码率、质量、分辨率等。应用配置文件后，仍然可以手动调整。

如果你反复使用同样的自定义设置，可以把它们保存为自己的配置文件。你可以创建、编辑和删除自定义配置文件，EncodeX 会记住最近使用的 5 个，方便快速访问。

## 只提取视频里的声音

<img src="/images/extract_audio.webp" alt="音频提取" width="1600" height="1054" loading="lazy">

找到一门课、一个播客、一段访谈或一场演唱会视频，但只要声音？拖入视频，选 MP3（或其他音频格式），就能得到一个随处可听的音乐文件。

如果视频有多条音轨（比如不同语言），可以选择保留哪一条。

## 裁剪视频

<img src="/images/cut_video.webp" alt="视频裁剪" width="1600" height="1267" loading="lazy">

剪掉无聊的部分。EncodeX 在视频下方显示时间轴：拖动两个滑块标记想要的起止位置，预览确认后保存。

时间轴可以放大，精确到零点几秒；配合缩略图和声波图，轻松定位每个瞬间。

## 压缩照片

<img src="/images/image_compress.webp" alt="图片压缩" width="1600" height="1060" loading="lazy">

高清照片很棒……直到需要发送的时候。EncodeX 压缩照片让它更小、上传更快，保存前还能实时预览效果。

支持常见格式：JPG、PNG、WebP、GIF、BMP、TIFF 等。还能查看每张照片的隐藏信息（相机参数、拍摄日期等）。

## 一次转换多个文件

<img src="/images/batch_process.webp" alt="批量处理队列" width="1600" height="1360" loading="lazy">

有 50 个视频？别一个一个转。全部拖进队列——EncodeX 自动依次处理，并显示每个文件的进度。

- 处理过程中可以继续添加文件
- 随时暂停、继续或取消
- 拖动调整列表顺序
- 完成后提醒你——或在队列结束后自动关机

## 查看文件的内在信息

<img src="/images/media_info.webp" alt="媒体信息" width="1600" height="1058" loading="lazy">

好奇一个文件里有什么？EncodeX 用大白话告诉你：时长、分辨率（比如 1080p）、大小、帧率、声道数等等。文件放不出来想知道原因时特别有用。

## 不费力的速度

在大多数现代电脑上，EncodeX 会自动使用显卡（就是打游戏那块芯片）大幅加速转换。什么都不用配置：它自己检测硬件并加以利用。

## 按你的习惯来

- **浅色或深色模式** —— 跟随系统，也可手动切换
- **35 种以上语言** —— 中文、西班牙语、印地语、日语、阿拉伯语、希伯来语（含从右到左界面）
- **键盘快捷键** —— 给不爱用鼠标的你
- **保持最新** —— EncodeX 提醒新版本并替你安装

## 天生注重隐私

一切都在你自己的电脑上完成：文件从不离开你的机器。没有账号、没有上传、没有追踪。

---

## 给好奇的人:幕后故事

EncodeX 基于 [FFmpeg](https://ffmpeg.org) 构建——众多知名应用背后久经考验的引擎——再套上一层友好的界面。喜欢技术细节的话：

- 支持 NVIDIA NVENC、Intel QSV、AMD AMF、VAAPI、Apple VideoToolbox 和 Media Foundation 硬件加速
- 提供命令行界面用于自动化
- 无损流复制可在不重新编码的情况下更换封装容器

开发者请查阅[技术文档](/zh/docs/architecture)或到 [GitHub](https://github.com/Sandeepv68/EncodeX) 看源代码。
