# Highlight 2 API

## 项目来源

项目来源：https://linux.do/t/topic/859589

原代码为 Deno 版本，本仓库额外添加提供 Vercel 版本部署支持。

## 简介

将 Highlight AI 接口转换为 OpenAI 兼容格式的代理服务。

## 手动部署

### Vercel (推荐)
1. 访问 [vercel.com](https://vercel.com)
2. 导入此 GitHub 仓库
3. 直接部署（零配置）

### Deno Deploy (备选)
1. 访问 [dash.deno.com](https://dash.deno.com)
2. New Project → GitHub 导入
3. 入口文件设为 `deno.ts`

## 使用

1. 部署后访问网页界面
2. 登录获取 API Key
3. 使用 OpenAI 客户端连接

### API 端点

- `/api/v1/models` - 模型列表
- `/api/v1/chat/completions` - 聊天接口

## 免责声明

仅供学习研究使用。