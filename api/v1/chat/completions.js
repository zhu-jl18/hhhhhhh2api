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
  const tokenResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/auth/token/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      refreshToken: userInfo.rt,
      clientUuid: userInfo.client_uuid,
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
  return formattedMessages.join("\n");
}

function formatOpenAITools(openaiTools) {
  if (!openaiTools) return [];

  return openaiTools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));
}

// 加密相关函数
function H7t() {
  return "9Xre3jOjBJqfVmcr";
}

async function kh(data, fixedIv) {
  const crypto = await import('crypto');
  const key = "highlight_ai_webapp_key";
  const keyBuffer = Buffer.from(key, 'utf8');

  // 使用 PBKDF2 派生密钥
  const derivedKey = crypto.pbkdf2Sync(keyBuffer, Buffer.from('highlight_salt', 'utf8'), 1000, 32, 'sha256');

  const iv = fixedIv || crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
  
  const dataBuffer = Buffer.from(JSON.stringify(data), 'utf8');
  let encrypted = cipher.update(dataBuffer);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const combined = Buffer.concat([iv, encrypted]);
  return combined.toString('base64');
}

async function getIdentifier(userId, clientUUID, fixedIv) {
  const t = await kh({ userId, clientUUID }, fixedIv);
  return `${H7t()}:${t}`;
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
      const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(highlightData),
      });

      if (!response.ok) {
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