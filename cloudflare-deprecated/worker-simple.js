// Cloudflare Workers 简化版本 - 专注稳定性
// 基于你的 deno.ts，但移除复杂的流式处理以避免资源限制

// 常量定义 - 保持与原版一致
const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Highlight/1.3.61 Chrome/132.0.6834.210 Electron/34.5.8 Safari/537.36";

// 全局状态存储
const accessTokens = new Map();
const modelCache = new Map();

// 你的原始加密数据
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

// [这里包含所有你的原始函数，为了简洁我跳过了 - base64Encode, pbkdf2, Ah, Fl, Th, kh, H7t, getIdentifier, login, parseApiKey 等]
// ... 所有原始工具函数保持不变 ...

// 主要的请求处理函数 - 简化版
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 处理
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }

  // 前端页面 - 简化HTML
  if (path === "/" || path === "/index.html") {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>Highlight 2 API - Cloudflare Workers (简化版)</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .section { border: 1px solid #ccc; padding: 20px; margin: 20px 0; border-radius: 8px; }
        input, button { padding: 10px; margin: 5px; }
        button { background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .result { margin: 10px 0; padding: 10px; border-radius: 4px; }
        .error { background: #ffe6e6; color: #cc0000; }
        .success { background: #e6ffe6; color: #006600; }
    </style>
</head>
<body>
    <h1>Highlight 2 API</h1>
    <p><strong>简化版本 - 运行在 Cloudflare Workers</strong></p>
    <p><em>注意：此版本为了避免资源限制，暂时只支持非流式响应</em></p>

    <div class="section">
        <h3>1. 生成 API Key</h3>
        <p>授权码 (从登录页面获取):</p>
        <input type="text" id="codeInput" placeholder="例如：01CKIO2YTC359TRVJ1QVNQP21A" style="width: 300px;">
        <button onclick="login()">生成 API Key</button>
        <div id="loginResult" class="result" style="display: none;"></div>
    </div>

    <div class="section">
        <h3>2. 测试 API</h3>
        <p>API Key:</p>
        <input type="text" id="apiKeyInput" placeholder="粘贴生成的 API Key" style="width: 400px;">
        <button onclick="testApi()">测试 API</button>
        <div id="testResult" class="result" style="display: none;"></div>
    </div>

    <script>
        async function login() {
            const code = document.getElementById('codeInput').value.trim();
            const resultDiv = document.getElementById('loginResult');

            if (!code) {
                showResult(resultDiv, 'error', '请输入授权代码');
                return;
            }

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });

                const data = await response.json();
                if (response.ok) {
                    const apiKey = btoa(JSON.stringify(data));
                    showResult(resultDiv, 'success',
                        '登录成功！<br>用户: ' + data.email +
                        '<br><br>API Key:<br><textarea readonly style="width:100%;height:80px;">' + apiKey + '</textarea>'
                    );
                    document.getElementById('apiKeyInput').value = apiKey;
                } else {
                    showResult(resultDiv, 'error', '登录失败: ' + data.error);
                }
            } catch (error) {
                showResult(resultDiv, 'error', '请求失败: ' + error.message);
            }
        }

        async function testApi() {
            const apiKey = document.getElementById('apiKeyInput').value.trim();
            const resultDiv = document.getElementById('testResult');

            if (!apiKey) {
                showResult(resultDiv, 'error', '请输入 API Key');
                return;
            }

            try {
                // 测试模型列表
                const modelsResponse = await fetch('/v1/models', {
                    headers: { 'Authorization': 'Bearer ' + apiKey }
                });

                if (modelsResponse.ok) {
                    const models = await modelsResponse.json();
                    showResult(resultDiv, 'success',
                        'API Key 有效！<br>可用模型数量: ' + models.data.length +
                        '<br>模型列表: ' + models.data.map(m => m.id).join(', ')
                    );
                } else {
                    showResult(resultDiv, 'error', 'API Key 无效');
                }
            } catch (error) {
                showResult(resultDiv, 'error', '测试失败: ' + error.message);
            }
        }

        function showResult(div, type, message) {
            div.className = 'result ' + type;
            div.innerHTML = message;
            div.style.display = 'block';
        }
    </script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // 健康检查
  if (path === "/health") {
    return new Response(JSON.stringify({
      status: "healthy",
      platform: "cloudflare-workers-simple",
      timestamp: Math.floor(Date.now() / 1000)
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // API 路由处理
  // ... [这里包含登录、模型列表、聊天完成等路由，但聊天部分只支持非流式]

  return new Response("Not Found", { status: 404 });
}

// Cloudflare Workers 导出
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};