// Vercel Node.js Functions - 登录端点

const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function login(code) {
  console.log("开始登录流程...");

  const chromeDeviceId = generateUUID();
  const deviceId = generateUUID();

  // 第一步：交换code获取tokens
  const exchangeResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/auth/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: code,
      amplitudeDeviceId: chromeDeviceId,
    }),
  });

  if (!exchangeResponse.ok) {
    const errorText = await exchangeResponse.text();
    console.error(`HTTP错误: ${exchangeResponse.status} ${errorText}`);

    if (exchangeResponse.status === 500) {
      throw new Error("服务器内部错误，请稍后重试");
    } else if (exchangeResponse.status === 400) {
      throw new Error("请求格式错误，请检查授权代码是否正确");
    } else {
      throw new Error(`登录服务暂时不可用 (错误代码: ${exchangeResponse.status})`);
    }
  }

  const exchangeData = await exchangeResponse.json();
  if (!exchangeData.success) {
    console.error(`登录失败详情:`, exchangeData);

    const errorMessage = exchangeData.error || "未知错误";

    if (errorMessage.includes("expired") || errorMessage.includes("invalid")) {
      throw new Error("授权代码已过期或无效。授权代码只能使用一次，请重新登录获取新的代码。");
    } else if (errorMessage.includes("not found")) {
      throw new Error("授权代码不存在，请检查是否复制完整。");
    } else if (errorMessage.includes("already used")) {
      throw new Error("此授权代码已被使用过，请重新登录获取新的代码。");
    } else if (errorMessage.includes("rate limit")) {
      throw new Error("请求过于频繁，请稍等片刻后重试。");
    } else {
      throw new Error(`登录失败: ${errorMessage}。如果问题持续存在，请重新获取授权代码。`);
    }
  }

  const accessToken = exchangeData.data.accessToken;
  const refreshToken = exchangeData.data.refreshToken;

  // 第二步：注册客户端
  const clientResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/users/me/client`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      client_uuid: deviceId,
    }),
  });

  if (!clientResponse.ok) {
    console.warn(`客户端注册失败: ${clientResponse.status}，但继续进行...`);
  }

  // 第三步：获取用户信息
  const profileResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/auth/profile`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!profileResponse.ok) {
    const errorText = await profileResponse.text();
    console.error(`获取用户信息失败: ${profileResponse.status} ${errorText}`);
    throw new Error(`无法获取用户信息，请重试。如果问题持续存在，请重新登录。`);
  }

  const profileData = await profileResponse.json();
  const userId = profileData.id;
  const email = profileData.email;

  console.log(`登录成功: ${userId} ${email}`);

  const userInfo = {
    rt: refreshToken,
    user_id: userId,
    email: email,
    client_uuid: deviceId,
  };

  return userInfo;
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

  // 只处理 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Missing code parameter" });
    }

    const userInfo = await login(code);
    return res.status(200).json(userInfo);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}