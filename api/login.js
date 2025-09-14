// Vercel Edge Functions - 登录端点
import { getCorsHeaders, login } from '../lib/utils.js';

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

  // 只处理 POST 请求
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders()
      }
    });
  }

  try {
    const body = await request.json();
    const code = body.code;

    if (!code) {
      return new Response(JSON.stringify({ error: "Missing code parameter" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders()
        }
      });
    }

    const userInfo = await login(code);

    return new Response(JSON.stringify(userInfo), {
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