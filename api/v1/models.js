// Vercel Node.js Functions - 模型列表 API

const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function fetchModelsFromUpstream(accessToken) {
  const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/models`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error("获取模型列表失败");
  }

  const respJson = await response.json();
  if (!respJson.success) {
    throw new Error("获取模型数据失败");
  }

  const modelList = [];
  for (const model of respJson.data) {
    modelList.push({
      id: model.name,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: model.provider,
    });
  }

  return modelList;
}

async function getAccessToken(userInfo) {
  // 刷新 access token
  const tokenResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      refreshToken: userInfo.rt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Token刷新失败");
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.success) {
    throw new Error("Token刷新失败");
  }

  return tokenData.data.accessToken;
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

function base64Decode(str) {
  const binaryString = Buffer.from(str, 'base64').toString('binary');
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

export default async function handler(req, res) {
  // CORS 设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // CORS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 只处理 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 获取并验证 Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.substring(7);
  const userInfo = parseApiKey(token);

  if (!userInfo || !userInfo.rt) {
    return res.status(401).json({ error: "Invalid authorization token" });
  }

  try {
    // 获取访问令牌并获取真实模型列表
    const accessToken = await getAccessToken(userInfo);
    const modelList = await fetchModelsFromUpstream(accessToken);

    return res.status(200).json({
      object: "list",
      data: modelList
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}