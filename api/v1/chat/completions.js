// Vercel Node.js Functions - 极简化聊天测试版本
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
    // 简单返回测试响应
    return res.status(200).json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: req.body.model || "gpt-4o",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: "测试响应：函数正常工作，但需要有效的API Key来获取真实回复"
        },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 10, completion_tokens: 25, total_tokens: 35 },
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      details: "极简测试版本出错"
    });
  }
};