// Vercel Edge Functions 版本 - 工具函数
// 转换自 deno.ts

// 常量定义
export const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";
export const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Highlight/1.3.61 Chrome/132.0.6834.210 Electron/34.5.8 Safari/537.36";

// 全局状态存储
export const accessTokens = new Map();
export const modelCache = new Map();

// 加密数据
export const Hr = {
  r: [87, 78, 72, 56, 79, 48, 122, 79, 107, 104, 82, 119, 51, 100, 78, 90, 85, 85, 69, 107, 90, 116, 87, 48, 108,
      53, 83, 84, 70, 81, 121, 69],
  m: [27, 26, 25, 22, 24, 21, 17, 12, 30, 19, 20, 14, 31, 8, 18, 10, 13, 5, 29, 7, 16, 6, 28, 23, 9, 15, 4, 0, 11,
      2, 3, 1]
};

export const jr = {
  r: [87, 90, 109, 107, 53, 105, 81, 89, 103, 107, 68, 49, 68, 105, 106, 77, 49, 106, 53, 78, 77, 78, 106, 106, 61,
      77, 89, 51, 66, 79, 86, 89, 106, 65, 106, 52, 89, 77, 87, 106, 89, 122, 78, 90, 65, 89, 50, 105, 61, 90, 106,
      66, 48, 53, 71, 89, 87, 52, 81, 84, 78, 90, 74, 78, 103, 50, 70, 79, 51, 50, 50, 77, 122, 108, 84, 81, 120,
      90, 89, 89, 89, 79, 119, 122, 121, 108, 69, 77],
  m: [65, 20, 1, 6, 31, 63, 74, 12, 85, 78, 33, 3, 41, 19, 45, 52, 75, 21, 23, 16, 56, 36, 5, 71, 87, 68, 72, 15,
      18, 32, 82, 8, 17, 54, 83, 35, 28, 48, 49, 77, 30, 25, 10, 38, 22, 50, 29, 11, 86, 64, 57, 70, 47, 67, 81, 44,
      61, 7, 58, 13, 84, 76, 42, 24, 46, 37, 62, 80, 27, 51, 73, 34, 69, 39, 53, 2, 79, 60, 26, 0, 66, 40, 55, 9,
      59, 43, 14, 4]
};

// Base64 编码/解码 - Vercel Edge 环境兼容
export function base64Encode(data) {
  if (data instanceof Uint8Array) {
    return btoa(String.fromCharCode(...data));
  }
  return btoa(data);
}

export function base64Decode(str) {
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// PBKDF2 密钥派生
export async function pbkdf2(password, salt, iterations, keyLen) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256"
    },
    key,
    keyLen * 8
  );

  return new Uint8Array(derivedBits);
}

// 加密相关函数
export function Ah(n, e) {
  const t = new Array(n.length);
  for (let s = 0; s < e.length; s++) {
    t[e[s]] = n[s];
  }
  return t;
}

export function Fl(n, e) {
  const t = Ah(n, e);
  const s = String.fromCharCode(...t);
  const o = base64Decode(s);
  const i = Array.from(new Uint8Array(o)).reverse();
  return new TextDecoder().decode(new Uint8Array(i));
}

export async function Th(n) {
  const salt = new TextEncoder().encode(Fl(Hr.r, Hr.m));
  return await pbkdf2(n, salt, 100000, 32);
}

export async function kh(n, fixedIv) {
  const e = await Th(n.userId);
  const t = fixedIv || crypto.getRandomValues(new Uint8Array(16));

  const data = {
    ...n,
    apiKey: Fl(jr.r, jr.m)
  };

  const jsonStr = JSON.stringify(data);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  // PKCS7 padding
  const padLen = 16 - (jsonBytes.length % 16);
  const paddedData = new Uint8Array(jsonBytes.length + padLen);
  paddedData.set(jsonBytes);
  paddedData.fill(padLen, jsonBytes.length);

  const key = await crypto.subtle.importKey("raw", e, { name: "AES-CBC" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv: t }, key, paddedData);

  const tHex = Array.from(t).map(b => b.toString(16).padStart(2, '0')).join('');
  const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${tHex}:${encryptedHex}`;
}

export function H7t(t = 12) {
  const randomBytes = crypto.getRandomValues(new Uint8Array(t));
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getIdentifier(userId, clientUUID, fixedIv) {
  const t = await kh({ userId, clientUUID }, fixedIv);
  return `${H7t()}:${t}`;
}

// API Key 相关函数
export function parseApiKey(apiKeyBase64) {
  try {
    const decoded = new TextDecoder().decode(base64Decode(apiKeyBase64));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function parseJwtPayload(jwtToken) {
  try {
    const parts = jwtToken.split(".");
    if (parts.length !== 3) return null;

    let payload = parts[1];
    const padding = payload.length % 4;
    if (padding) {
      payload += "=".repeat(4 - padding);
    }

    const decoded = new TextDecoder().decode(base64Decode(payload));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// Token 刷新
export async function refreshAccessToken(rt) {
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

  const newAccessToken = respJson.data.accessToken;
  const payload = parseJwtPayload(newAccessToken);
  const expiresAt = payload?.exp || Math.floor(Date.now() / 1000) + 3600;

  accessTokens.set(rt, {
    access_token: newAccessToken,
    expires_at: expiresAt,
  });

  return newAccessToken;
}

export async function getAccessToken(rt) {
  const tokenInfo = accessTokens.get(rt);
  const currentTime = Math.floor(Date.now() / 1000);

  if (tokenInfo && tokenInfo.expires_at > currentTime + 60) {
    return tokenInfo.access_token;
  }

  return await refreshAccessToken(rt);
}

// 模型管理
export async function fetchModelsFromUpstream(accessToken) {
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

  modelCache.clear();
  for (const model of respJson.data) {
    modelCache.set(model.name, {
      id: model.id,
      name: model.name,
      provider: model.provider,
      isFree: model.pricing?.isFree || false,
    });
  }
}

export async function getModels(accessToken) {
  if (modelCache.size === 0) {
    await fetchModelsFromUpstream(accessToken);
  }
  return modelCache;
}

// HTTP 请求头生成
export function getHighlightHeaders(accessToken, identifier) {
  const headers = {
    "accept": "*/*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "zh-CN",
    "authorization": `Bearer ${accessToken}`,
    "content-type": "application/json",
    "user-agent": USER_AGENT,
  };

  if (identifier) {
    headers["identifier"] = identifier;
  }

  return headers;
}

// 消息格式化
export function formatMessagesToPrompt(messages) {
  const formattedMessages = [];
  for (const message of messages) {
    if (message.role) {
      if (message.content) {
        if (Array.isArray(message.content)) {
          for (const item of message.content) {
            formattedMessages.push(`${message.role}: ${item.text}`);
          }
        } else {
          formattedMessages.push(`${message.role}: ${message.content}`);
        }
      }
      if (message.tool_calls) {
        formattedMessages.push(`${message.role}: ${JSON.stringify(message.tool_calls)}`);
      }
      if (message.tool_call_id) {
        formattedMessages.push(`${message.role}: tool_call_id: ${message.tool_call_id} ${message.content}`);
      }
    }
  }
  return formattedMessages.join("\n\n");
}

export function formatOpenAITools(openaiTools) {
  if (!openaiTools) return [];

  return openaiTools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));
}

// CORS 处理
export function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

// 登录功能
export async function login(code) {
  console.log("开始登录流程...");

  const chromeDeviceId = crypto.randomUUID();
  const deviceId = crypto.randomUUID();

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

  // 生成API Key
  const apiKey = base64Encode(JSON.stringify(userInfo));
  console.log("----API KEY----");
  console.log(apiKey);
  console.log("----API KEY----");

  return userInfo;
}