// Vercel Node.js Functions - 最简化测试版聊天完成 API
const crypto = require('crypto');

const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Highlight/1.3.61 Chrome/132.0.6834.210 Electron/34.5.8 Safari/537.36";

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

async function refreshAccessToken(rt) {
  const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ refreshToken: rt }),
  });

  if (!response.ok) {
    throw new Error("Token refresh failed");
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error("Token refresh failed");
  }

  return data.data.accessToken;
}

module.exports = async function handler(req, res) {
  // CORS 设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 验证token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const token = authHeader.substring(7);
    const userInfo = parseApiKey(token);

    if (!userInfo || !userInfo.rt) {
      return res.status(401).json({ error: "Invalid authorization token" });
    }

    // 获取access token
    const accessToken = await refreshAccessToken(userInfo.rt);

    // 获取模型列表来找到默认模型ID
    const modelsResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/models`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': USER_AGENT,
      },
    });

    if (!modelsResponse.ok) {
      throw new Error("Failed to get models");
    }

    const modelsData = await modelsResponse.json();
    const defaultModelId = modelsData.data[0]?.id;

    // 格式化消息
    const reqData = req.body;
    let prompt = "";
    for (const message of reqData.messages) {
      if (message.content) {
        prompt += `${message.role}: ${message.content}\n\n`;
      }
    }

    // 构建请求数据
    const highlightData = {
      prompt: prompt.trim(),
      attachedContext: [],
      modelId: defaultModelId,
      additionalTools: [],
      backendPlugins: [],
      useMemory: false,
      useKnowledge: false,
      ephemeral: false,
      timezone: "Asia/Hong_Kong",
    };

    // 不带identifier先测试
    const headers = {
      "accept": "*/*",
      "authorization": `Bearer ${accessToken}`,
      "content-type": "application/json",
      "user-agent": USER_AGENT,
    };

    const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(highlightData),
    });

    if (!response.ok) {
      return res.status(500).json({
        error: `Highlight API returned status ${response.status}`,
        details: await response.text()
      });
    }

    // 简单返回成功信息
    return res.status(200).json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: reqData.model || "gpt-4o",
      choices: [{
        index: 0,
        message: { role: "assistant", content: "API connection successful - processing response..." },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};