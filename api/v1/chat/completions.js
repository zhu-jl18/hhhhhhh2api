// Vercel Node.js Functions - 聊天完成 API (修复token刷新)
const { parseApiKey, getAccessToken } = require('../../lib/auth');

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

    if (!userInfo.user_id || !userInfo.client_uuid) {
      return res.status(401).json({ error: "Invalid authorization token - missing required fields" });
    }

    // 测试token刷新
    try {
      const accessToken = await getAccessToken(userInfo.rt);

      return res.status(200).json({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: req.body.model || "gpt-4o",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: `Token刷新成功！Access token前20个字符: ${accessToken.substring(0, 20)}...`
          },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
      });

    } catch (error) {
      return res.status(402).json({
        error: "Token刷新失败",
        details: error.message,
        user_info: {
          user_id: userInfo.user_id,
          email: userInfo.email,
          client_uuid: userInfo.client_uuid
        }
      });
    }

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      details: "chat completions处理出错"
    });
  }
};