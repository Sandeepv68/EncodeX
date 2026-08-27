# 帮助 EncodeX 变得更好

EncodeX 免费开放，由志愿者打造——你不需要会编程也能出一份力。任何人都可以这样参与：

- **出问题时告诉我们。** 应用崩溃或文件转换失败时，[提交一个 issue](https://github.com/Sandeepv68/EncodeX/issues) 并描述发生了什么。普通用户的缺陷报告非常宝贵。
- **提出想法。** 希望 EncodeX 增加某个还没有的功能？尽管说——许多功能都源自用户建议。
- **参与翻译。** EncodeX 支持 35 种以上语言，随时欢迎翻译志愿者。如果你的语言缺失或翻译生硬，欢迎帮忙改进。
- **帮忙宣传。** 向朋友推荐 EncodeX、写评价或制作教程。

## 联系我们

有问题、有想法，或者只想打个招呼？直接发邮件给开发者：**[developer@encodex.in](mailto:developer@encodex.in)** ——用户的反馈永远受欢迎。

## 开发者指南

想贡献代码？从这里开始：

### 开发

```bash
npm run dev          # 热重载开发模式
npm run electron:dev # 带 Electron 窗口的完整开发环境
npm run build        # 完整构建
npm start            # 运行已构建的应用
```

### 项目规范

- **TypeScript** — 严格模式，尽量避免 `any`。
- **React** — 使用 hooks 的函数式组件。
- **状态** — 全局状态使用 Zustand store。
- **IPC** — 所有通道定义在 `src/shared/ipc-channels.ts`。
- **常量** — 硬编码值放在 `src/shared/` 下的常量文件中。
- **i18n** — 所有界面文案位于 `src/renderer/i18n/locales/`。

### Pull Request 流程

1. 确保构建通过：`npm run build`
2. 新增或修改界面文案时同步更新语言文件。
3. 每个 PR 只解决一个问题。

## 行为准则

本项目遵循 [Contributor Covenant](https://github.com/Sandeepv68/EncodeX/blob/main/CODE_OF_CONDUCT.md)。请友善相待、互相尊重——大家都是因为喜欢这个项目才聚在一起。
