# Highlight2API - Vercel 部署版本

这是一个将 Highlight AI API 转换为 OpenAI 兼容格式的代理服务，现已迁移至 Vercel Node.js Functions。

## 🚀 快速部署

### 方法 1: 使用 Vercel CLI（推荐）

1. 安装 Vercel CLI：
```bash
npm install -g vercel
```

2. 登录 Vercel：
```bash
vercel login
```

3. 在项目目录中部署：
```bash
vercel --prod
```

### 方法 2: 通过 GitHub 连接

1. 将代码推送到 GitHub 仓库
2. 在 [Vercel](https://vercel.com) 网站上导入你的 GitHub 仓库
3. Vercel 会自动检测配置并部署

## 🛠️ 本地开发

```bash
# 启动本地开发服务器
npm run dev
```

## 📁 项目结构

```
├── api/                    # Vercel API 端点
│   ├── login.js           # 登录端点
│   └── v1/
│       ├── models.js      # 模型列表 API
│       └── chat/
│           └── completions.js  # 聊天完成 API
├── index.html             # 前端界面
├── vercel.json           # Vercel 配置
└── package.json          # 项目配置
```

## 🔧 API 端点

- **主页**: `/` 或 `/index.html`
- **登录**: `POST /api/login`
- **模型列表**: `GET /v1/models`
- **聊天完成**: `POST /v1/chat/completions`

## 💝 修复的问题

1. **运行时兼容性**: 从 Edge Functions 迁移到 Node.js Functions，解决了兼容性问题
2. **模块导入**: 修复了 `crypto` 模块的导入问题
3. **文件结构**: 重组了文件结构，符合 Vercel 的最佳实践
4. **静态文件**: 将 HTML 内容提取到静态文件，提高性能
5. **路由配置**: 配置了正确的 URL 重写规则

## 🌟 技术栈

- **运行时**: Node.js 18+
- **平台**: Vercel
- **前端**: 原生 HTML/CSS/JavaScript
- **后端**: Node.js Functions

## 📝 使用说明

1. 访问部署的网站
2. 按照页面提示获取 API Key
3. 使用 OpenAI 兼容的客户端访问 API

## 🔗 相关链接

- [Vercel 文档](https://vercel.com/docs)
- [Highlight AI](https://highlightai.com)

---

由 **三文鱼** 开发 · [Linux DO @三文鱼](https://linux.do/u/462642146/summary)