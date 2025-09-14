// Vercel Node.js Functions - 模型列表 API

const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ... existing code ...
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

function Ah(n, e) {
  const t = new Array(n.length);
  for (let s = 0; s < e.length; s++) {
    t[e[s]] = n[s];
  }
  return t;
}

function Fl(n, e) {
  const t = Ah(n, e);
  const s = String.fromCharCode(...t);
  const binaryString = Buffer.from(s, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const i = Array.from(bytes).reverse();
  return new TextDecoder().decode(new Uint8Array(i));
}

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