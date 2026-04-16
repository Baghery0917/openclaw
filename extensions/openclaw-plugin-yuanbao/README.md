# openclaw-plugin-yuanbao

[![npm version](https://img.shields.io/npm/v/openclaw-plugin-yuanbao.svg)](https://www.npmjs.com/package/openclaw-plugin-yuanbao)

腾讯元宝智能机器人频道插件，让你的 OpenClaw 机器人能够接入元宝 Bot 通道，支持私聊和群聊。

## ✨ 功能特性

| 能力 | 描述 |
|------|------|
| 💬 群聊互动 | 在元宝派群组中，成员 @元宝Bot 即可触发 AI 回复 |
| 🧠 长期记忆 | 记住与创建者的历史对话，越聊越懂你 |
| ⏰ 随时在线 | 云端部署，7×24 小时在线服务派友 |
| 🔍 联网搜索 | 自动接入 Web Search，回答实时信息 |

## 🚀 快速开始

### 1. 安装插件

```bash
openclaw plugins install openclaw-plugin-yuanbao
```

### 2. 配置通道

```bash
openclaw channels add
```

根据提示输入：
- **AppID**: 元宝 APP 的 APP ID
- **AppSecret**: 元宝 APP 的密钥

### 3. 开始使用

配置完成后，用户可以：
- **私聊** - 直接向机器人发送消息
- **群聊** - @机器人 或回复机器人消息触发对话

## 🛠️ Bot 常用命令

```
/yuanbaobot-upgrade   # 升级元宝插件（需机器人主人权限）
/issue-log            # 提交问题日志
```

## ❓ 常见问题

### 连接失败
- 检查 `AppID` 和 `AppSecret` 是否正确

## 📚 相关文档
- [元宝官网](https://yuanbao.tencent.com)

## 🔧 系统要求

- OpenClaw >= 2026.3.22
- Node.js >= 18
