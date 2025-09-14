// Vercel Node.js Functions - 模型列表 API
const { HIGHLIGHT_BASE_URL, USER_AGENT, parseApiKey, getAccessToken } = require('../../lib/auth');
const { handleCors } = require('../../lib/utils');

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

module.exports = async function handler(req, res) {
  // 处理 CORS
  if (handleCors(req, res)) {
    return; // OPTIONS 请求已处理
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
    const accessToken = await getAccessToken(userInfo.rt);
    const modelList = await fetchModelsFromUpstream(accessToken);

    return res.status(200).json({
      object: "list",
      data: modelList
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};