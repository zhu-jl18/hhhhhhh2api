const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Highlight/1.3.61 Chrome/132.0.6834.210 Electron/34.5.8 Safari/537.36";

// Token缓存
const tokenCache = new Map();

function parseApiKey(apiKeyBase64) {
  try {
    // 直接使用Node.js的Buffer解码，然后清理控制字符
    const decoded = Buffer.from(apiKeyBase64, 'base64').toString('utf8')
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, ''); // 清理控制字符
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function parseJwtPayload(jwtToken) {
  try {
    const parts = jwtToken.split(".");
    if (parts.length !== 3) return null;

    let payload = parts[1];
    const padding = payload.length % 4;
    if (padding) {
      payload += "=".repeat(4 - padding);
    }

    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function refreshAccessToken(rt) {
  const tokenResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refreshToken: rt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Token刷新失败");
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.success) {
    throw new Error("Token刷新失败");
  }

  const newAccessToken = tokenData.data.accessToken;
  const payload = parseJwtPayload(newAccessToken);
  const expiresAt = payload?.exp || Math.floor(Date.now() / 1000) + 3600;

  // 更新缓存
  tokenCache.set(rt, {
    access_token: newAccessToken,
    expires_at: expiresAt,
  });

  return newAccessToken;
}

async function getAccessToken(rt) {
  const tokenInfo = tokenCache.get(rt);
  const currentTime = Math.floor(Date.now() / 1000);

  // 如果token存在且未过期（提前60秒刷新）
  if (tokenInfo && tokenInfo.expires_at > currentTime + 60) {
    return tokenInfo.access_token;
  }

  // 刷新token
  return await refreshAccessToken(rt);
}

function getHighlightHeaders(accessToken, identifier) {
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

module.exports = {
  HIGHLIGHT_BASE_URL,
  USER_AGENT,
  parseApiKey,
  parseJwtPayload,
  refreshAccessToken,
  getAccessToken,
  getHighlightHeaders
};