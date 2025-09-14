// Vercel Node.js Functions - 聊天完成 API

const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function base64Decode(str) {
  const binaryString = Buffer.from(str, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function parseApiKey(apiKeyBase64) {
  try {
    const decoded = new TextDecoder().decode(base64Decode(apiKeyBase64));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function getAccessToken(userInfo) {
  // 刷新 access token
  const tokenResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      refreshToken: userInfo.rt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Token刷新失败");
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.success) {
    throw new Error("Token刷新失败");
  }

  return tokenData.data.accessToken;
}

async function getModels(accessToken) {
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

  const modelMap = new Map();
  for (const model of respJson.data) {
    modelMap.set(model.name, {
      id: model.id,
      name: model.name,
      provider: model.provider,
      isFree: model.pricing?.isFree || false,
    });
  }

  return modelMap;
}

function formatMessagesToPrompt(messages) {
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

function formatOpenAITools(openaiTools) {
  if (!openaiTools) return [];

  return openaiTools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));
}

// 原始加密常量和函数
const Hr = {
  r: [87, 78, 72, 56, 79, 48, 122, 79, 107, 104, 82, 119, 51, 100, 78, 90, 85, 85, 69, 107, 90, 116, 87, 48, 108,
      53, 83, 84, 70, 81, 121, 69],
  m: [27, 26, 25, 22, 24, 21, 17, 12, 30, 19, 20, 14, 31, 8, 18, 10, 13, 5, 29, 7, 16, 6, 28, 23, 9, 15, 4, 0, 11,
      2, 3, 1]
};

const jr = {
  r: [87, 90, 109, 107, 53, 105, 81, 89, 103, 107, 68, 49, 68, 105, 106, 77, 49, 106, 53, 78, 77, 78, 106, 106, 61,
      77, 89, 51, 66, 79, 86, 89, 106, 65, 106, 52, 89, 77, 87, 106, 89, 122, 78, 90, 65, 89, 50, 105, 61, 90, 106,
      66, 48, 53, 71, 89, 87, 52, 81, 84, 78, 90, 74, 78, 103, 50, 70, 79, 51, 50, 50, 77, 122, 108, 84, 81, 120,
      90, 89, 89, 89, 79, 119, 122, 121, 108, 69, 77],
  m: [65, 20, 1, 6, 31, 63, 74, 12, 85, 78, 33, 3, 41, 19, 45, 52, 75, 21, 23, 16, 56, 36, 5, 71, 87, 68, 72, 15,
      18, 32, 82, 8, 17, 54, 83, 35, 28, 48, 49, 77, 30, 25, 10, 38, 22, 50, 29, 11, 86, 64, 57, 70, 47, 67, 81, 44,
      61, 7, 58, 13, 84, 76, 42, 24, 46, 37, 62, 80, 27, 51, 73, 34, 69, 39, 53, 2, 79, 60, 26, 0, 66, 40, 55, 9,
      59, 43, 14, 4]
};

function Ah(n, e) {
  const t = new Array(n.length);
  for (let s = 0; s < e.length; s++) {
    t[e[s]] = n[s];
  }
  return t;
}

function Fl(n, e) {
  const t = Ah(n, e);
  const s = String.fromCharCode(...t);
  const binaryString = Buffer.from(s, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const i = Array.from(bytes).reverse();
  return new TextDecoder().decode(new Uint8Array(i));
}

async function pbkdf2(password, salt, iterations, keyLen) {
  const crypto = await import('crypto');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keyLen, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(new Uint8Array(derivedKey));
    });
  });
}

async function Th(n) {
  const salt = new TextEncoder().encode(Fl(Hr.r, Hr.m));
  return await pbkdf2(n, salt, 100000, 32);
}

async function kh(n, fixedIv) {
  const crypto = await import('crypto');
  const e = await Th(n.userId);
  const t = fixedIv || crypto.randomBytes(16);
  
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
  
  const cipher = crypto.createCipheriv('aes-256-cbc', e, t);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(paddedData)), cipher.final()]);
  
  const tHex = Array.from(t).map(b => b.toString(16).padStart(2, '0')).join('');
  const encryptedHex = Array.from(encrypted).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${tHex}:${encryptedHex}`;
}

async function H7t(t = 12) {
  const crypto = await import('crypto');
  const randomBytes = crypto.randomBytes(t);
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getIdentifier(userId, clientUUID, fixedIv) {
  const t = await kh({ userId, clientUUID }, fixedIv);
  const randomHex = await H7t();
  return `${randomHex}:${t}`;
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
    const reqData = req.body;

    if (!userInfo.user_id || !userInfo.client_uuid) {
      return res.status(401).json({ error: "Invalid authorization token - missing required fields" });
    }

    const accessToken = await getAccessToken(userInfo);
    const models = await getModels(accessToken);
    const modelInfo = models.get(reqData.model || "gpt-4o");

    if (!modelInfo) {
      return res.status(400).json({ error: `Model '${reqData.model}' not found` });
    }

    const prompt = formatMessagesToPrompt(reqData.messages);
    const tools = formatOpenAITools(reqData.tools);
    const identifier = await getIdentifier(userInfo.user_id, userInfo.client_uuid);

    const highlightData = {
      prompt: prompt,
      attachedContext: [],
      modelId: modelInfo.id,
      additionalTools: tools,
      backendPlugins: [],
      useMemory: false,
      useKnowledge: false,
      ephemeral: false,
      timezone: "Asia/Hong_Kong",
    };

    const headers = getHighlightHeaders(accessToken, identifier);

    if (reqData.stream) {
      // 流式响应
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(highlightData),
        });

        if (!response.ok) {
          res.write(`data: ${JSON.stringify({
            error: { message: `Highlight API returned status code ${response.status}`, type: "api_error" }
          })}\n\n`);
          return res.end();
        }

        const responseId = `chatcmpl-${generateUUID()}`;
        const created = Math.floor(Date.now() / 1000);

        // 发送初始消息
        const initialChunk = {
          id: responseId,
          object: "chat.completion.chunk",
          created: created,
          model: reqData.model || "gpt-4o",
          choices: [{
            index: 0,
            delta: { role: "assistant" },
            finish_reason: null,
          }],
        };
        res.write(`data: ${JSON.stringify(initialChunk)}\n\n`);

        const reader = response.body;
        let buffer = "";

        reader.on('data', (chunk) => {
          buffer += chunk.toString();

          while (buffer.includes("\n")) {
            const lineEnd = buffer.indexOf("\n");
            const line = buffer.substring(0, lineEnd);
            buffer = buffer.substring(lineEnd + 1);

            if (line.startsWith("data: ")) {
              const data = line.substring(6).trim();
              if (data) {
                try {
                  const eventData = JSON.parse(data);
                  if (eventData.type === "text") {
                    const content = eventData.content || "";
                    if (content) {
                      const chunkData = {
                        id: responseId,
                        object: "chat.completion.chunk",
                        created: created,
                        model: reqData.model || "gpt-4o",
                        choices: [{
                          index: 0,
                          delta: { content: content },
                          finish_reason: null,
                        }],
                      };
                      res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
                    }
                  }
                } catch {
                  // 忽略无效的JSON数据
                }
              }
            }
          }
        });

        reader.on('end', () => {
          // 发送完成消息
          const finalChunk = {
            id: responseId,
            object: "chat.completion.chunk",
            created: created,
            model: reqData.model || "gpt-4o",
            choices: [{
              index: 0,
              delta: {},
              finish_reason: "stop",
            }],
          };
          res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        });

        reader.on('error', (error) => {
          res.write(`data: ${JSON.stringify({
            error: { message: error.message, type: "server_error" }
          })}\n\n`);
          res.end();
        });

      } catch (error) {
        res.write(`data: ${JSON.stringify({
          error: { message: error.message, type: "server_error" }
        })}\n\n`);
        res.end();
      }
    } else {
      // 非流式响应
      console.log('发送到 Highlight API 的数据:', JSON.stringify(highlightData, null, 2));
      console.log('请求头:', JSON.stringify(headers, null, 2));
      
      const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(highlightData),
      });

      console.log(`Highlight API 响应状态: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Highlight API 错误响应:', errorText);
        return res.status(response.status).json({
          error: { message: `Highlight API returned status code ${response.status}`, type: "api_error" }
        });
      }

      let fullResponse = "";
      const reader = response.body;
      let buffer = "";

      return new Promise((resolve, reject) => {
        reader.on('data', (chunk) => {
          buffer += chunk.toString();

          while (buffer.includes("\n")) {
            const lineEnd = buffer.indexOf("\n");
            const line = buffer.substring(0, lineEnd);
            buffer = buffer.substring(lineEnd + 1);

            if (line.startsWith("data: ")) {
              const data = line.substring(6).trim();
              if (data) {
                try {
                  const eventData = JSON.parse(data);
                  if (eventData.type === "text") {
                    fullResponse += eventData.content || "";
                  }
                } catch {
                  // 忽略无效的JSON数据
                }
              }
            }
          }
        });

        reader.on('end', () => {
          const responseId = `chatcmpl-${generateUUID()}`;
          const responseData = {
            id: responseId,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: reqData.model || "gpt-4o",
            choices: [{
              index: 0,
              message: { role: "assistant", content: fullResponse },
              finish_reason: "stop",
            }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          };

          res.status(200).json(responseData);
          resolve();
        });

        reader.on('error', (error) => {
          res.status(500).json({ error: error.message });
          reject(error);
        });
      });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}