// 完全按照deno.ts实现的Node.js版本
const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";

function parseApiKey(apiKeyBase64) {
  try {
    const decoded = Buffer.from(apiKeyBase64, 'base64').toString('utf8')
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, ''); // 清理控制字符
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
    },
    body: JSON.stringify({ refreshToken: rt }),
  });

  if (!response.ok) {
    throw new Error("无法刷新access token");
  }

  const respJson = await response.json();
  if (!respJson.success) {
    throw new Error("刷新access token失败");
  }

  return respJson.data.accessToken;
}

function formatMessagesToPrompt(messages) {
  const formattedMessages = [];
  for (const message of messages) {
    if (message.role && message.content) {
      if (Array.isArray(message.content)) {
        for (const item of message.content) {
          formattedMessages.push(`${message.role}: ${item.text}`);
        }
      } else {
        formattedMessages.push(`${message.role}: ${message.content}`);
      }
    }
  }
  return formattedMessages.join("\n\n");
}

module.exports = async function handler(req, res) {
  // CORS处理
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const token = authHeader.substring(7);
    const userInfo = parseApiKey(token);

    if (!userInfo || !userInfo.rt) {
      return res.status(401).json({ error: "Invalid authorization token" });
    }

    if (!userInfo.user_id || !userInfo.client_uuid) {
      return res.status(401).json({ error: "Invalid authorization token - missing required fields" });
    }

    const reqData = req.body;
    const accessToken = await refreshAccessToken(userInfo.rt);

    return res.status(200).json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: reqData.model || "gpt-4o",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: `✅ Token刷新成功！现在可以正常使用API了。Access Token: ${accessToken.substring(0, 20)}...`
        },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
};