// Cloudflare Workers 版本
// 基于你的 deno.ts 改写

// 你的原始接口类型定义保持不变
const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Highlight/1.3.61 Chrome/132.0.6834.210 Electron/34.5.8 Safari/537.36";

// 全局状态存储 (Workers 有内存限制，可能需要 Durable Objects)
const accessTokens = new Map();
const modelCache = new Map();

// 你的加密数据 - 直接复制
const Hr = {
  r: [87, 78, 72, 56, 79, 48, 122, 79, 107, 104, 82, 119, 51, 100, 78, 90, 85, 85, 69, 107, 90, 116, 87, 48, 108,
      53, 83, 84, 70, 81, 121, 69],
  m: [27, 26, 25, 22, 24, 21, 17, 12, 30, 19, 20, 14, 31, 8, 18, 10, 13, 5, 29, 7, 16, 6, 28, 23, 9, 15, 4, 0, 11,
      2, 3, 1]
};

const jr = {
  r: [87, 90, 109, 107, 53, 105, 81, 89, 103, 107, 68, 49, 68, 105, 106, 77, 49, 106, 53, 78, 77, 78, 106, 106, 61,
      77, 89, 51, 66, 79, 86, 89, 106, 65, 106, 52, 89, 77, 87, 106, 89, 122, 78, 90, 65, 89, 50, 105, 61, 90, 106,
      66, 48, 53, 71, 89, 87, 52, 81, 84, 78, 90, 74, 78, 103, 50, 70, 79, 51, 50, 50, 77, 122, 108, 84, 81, 120,
      90, 89, 89, 89, 79, 119, 122, 121, 108, 69, 77],
  m: [65, 20, 1, 6, 31, 63, 74, 12, 85, 78, 33, 3, 41, 19, 45, 52, 75, 21, 23, 16, 56, 36, 5, 71, 87, 68, 72, 15,
      18, 32, 82, 8, 17, 54, 83, 35, 28, 48, 49, 77, 30, 25, 10, 38, 22, 50, 29, 11, 86, 64, 57, 70, 47, 67, 81, 44,
      61, 7, 58, 13, 84, 76, 42, 24, 46, 37, 62, 80, 27, 51, 73, 34, 69, 39, 53, 2, 79, 60, 26, 0, 66, 40, 55, 9,
      59, 43, 14, 4]
};

// Base64 编码/解码函数 - Cloudflare Workers 原生支持
function base64Encode(data) {
  return btoa(new TextDecoder().decode(data));
}

function base64Decode(str) {
  return new TextEncoder().encode(atob(str));
}

// 将你的所有函数复制过来，只需要替换：
// 1. 导入语句删除
// 2. Deno.env.get() 改为 env.get() (环境变量通过 Worker 的 env 参数传入)
// 3. serve() 改为 addEventListener('fetch', ...)

// 复制你的所有核心函数：pbkdf2, Ah, Fl, Th, kh, H7t, getIdentifier, login, parseApiKey 等...

// 主要的请求处理函数 - 基于你的 handleRequest
async function handleRequest(request, env) {
  // 将你的整个 handleRequest 函数内容复制过来
  // 只需要将 Deno.env.get() 改为 env.get()

  const url = new URL(request.url);
  const path = url.pathname;

  // 处理预检请求
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400",
      }
    });
  }

  // 这里复制你的所有路由处理逻辑...
  // 前端页面、健康检查、登录端点、模型列表、聊天完成等

  return new Response("Not Found", { status: 404 });
}

// Cloudflare Workers 入口点
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env));
});

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};