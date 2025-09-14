// Vercel Edge Functions - 模型列表 API

export const config = {
  runtime: 'edge',
};

// 工具函数
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

function base64Decode(str) {
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function parseApiKey(apiKeyBase64) {
  try {
    const decoded = new TextDecoder().decode(base64Decode(apiKeyBase64));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export default async function handler(request) {
  // CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders()
    });
  }

  // 只处理 GET 请求
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders()
      }
    });
  }

  // 获取并验证 Bearer token
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization token" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      }
    });
  }

  const token = authHeader.substring(7);
  const userInfo = parseApiKey(token);

  if (!userInfo || !userInfo.rt) {
    return new Response(JSON.stringify({ error: "Invalid authorization token" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      }
    });
  }

  // 返回模拟的模型列表
  const modelList = [
    {
      id: "gpt-4o",
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "openai",
    },
    {
      id: "gpt-4o-mini",
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "openai",
    },
    {
      id: "claude-3.5-sonnet",
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "anthropic",
    }
  ];

  return new Response(JSON.stringify({
    object: "list",
    data: modelList
  }), {
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders()
    }
  });
}