// Vercel Edge Functions - 模型列表 API
import {
  getCorsHeaders,
  parseApiKey,
  getAccessToken,
  getModels
} from '../../lib/utils.js';

export const config = {
  runtime: 'edge',
};

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

  try {
    const accessToken = await getAccessToken(userInfo.rt);
    const models = await getModels(accessToken);

    const modelList = Array.from(models.entries()).map(([modelName, modelInfo]) => ({
      id: modelName,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: modelInfo.provider,
    }));

    return new Response(JSON.stringify({
      object: "list",
      data: modelList
    }), {
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      }
    });
  }
}