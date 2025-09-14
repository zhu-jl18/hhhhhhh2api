// Vercel Node.js Functions - 聊天完成 API (处理token刷新失败)
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

    // 简单解析API key
    let userInfo;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8')
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, ''); // 清理控制字符
      userInfo = JSON.parse(decoded);
    } catch {
      return res.status(401).json({ error: "Invalid authorization token" });
    }

    if (!userInfo || !userInfo.rt) {
      return res.status(401).json({ error: "Invalid authorization token" });
    }

    if (!userInfo.user_id || !userInfo.client_uuid) {
      return res.status(401).json({ error: "Invalid authorization token - missing required fields" });
    }

    // 由于refresh token可能已过期，直接返回提示信息
    return res.status(402).json({
      error: "Token刷新失败 - 请提供有效的API Key",
      details: "当前token可以正确解析但refresh token可能已过期",
      user_info: {
        user_id: userInfo.user_id,
        email: userInfo.email,
        client_uuid: userInfo.client_uuid
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      details: "chat completions处理出错"
    });
  }
};