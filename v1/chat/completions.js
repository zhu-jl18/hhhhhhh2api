// Vercel Edge Functions - 聊天完成 API

export const config = {
  runtime: 'edge',
};

const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// 工具函数
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

function base64Decode(str) {
  const binaryString = atob(str);
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
  const key = "highlight_ai_webapp_key";
  const keyBuffer = new TextEncoder().encode(key);

  // 使用 PBKDF2 派生密钥
  const importedKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('highlight_salt'),
      iterations: 1000,
      hash: 'SHA-256',
    },
    importedKey,
    256
  );

  const derivedKey = await crypto.subtle.importKey(
    'raw',
    derivedBits,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  const iv = fixedIv || crypto.getRandomValues(new Uint8Array(16));
  const dataBuffer = new TextEncoder().encode(JSON.stringify(data));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    derivedKey,
    dataBuffer
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
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
    const reqData = await request.json();

    if (!userInfo.user_id || !userInfo.client_uuid) {
      return new Response(JSON.stringify({ error: "Invalid authorization token - missing required fields" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders()
        }
      });
    }

    const accessToken = await getAccessToken(userInfo);
    const models = await getModels(accessToken);
    const modelInfo = models.get(reqData.model || "gpt-4o");

    if (!modelInfo) {
      return new Response(JSON.stringify({ error: `Model '${reqData.model}' not found` }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders()
        }
      });
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
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(highlightData),
            });

            if (!response.ok) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                error: { message: `Highlight API returned status code ${response.status}`, type: "api_error" }
              })}\n\n`));
              controller.close();
              return;
            }

            const responseId = `chatcmpl-${crypto.randomUUID()}`;
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
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(initialChunk)}\n\n`));

            const reader = response.body?.getReader();
            if (!reader) return;

            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += new TextDecoder().decode(value);

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
                          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunkData)}\n\n`));
                        }
                      }
                    } catch {
                      // 忽略无效的JSON数据
                    }
                  }
                }
              }
            }

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
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();

          } catch (error) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
              error: { message: error.message, type: "server_error" }
            })}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...getCorsHeaders()
        }
      });
    } else {
      // 非流式响应
      const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(highlightData),
      });

      if (!response.ok) {
        return new Response(JSON.stringify({
          error: { message: `Highlight API returned status code ${response.status}`, type: "api_error" }
        }), {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders()
          }
        });
      }

      let fullResponse = "";
      const reader = response.body?.getReader();
      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += new TextDecoder().decode(value);

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
        }
      }

      const responseId = `chatcmpl-${crypto.randomUUID()}`;
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

      return new Response(JSON.stringify(responseData), {
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders()
        }
      });
    }
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