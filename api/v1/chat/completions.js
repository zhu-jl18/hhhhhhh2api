// Vercel Edge Functions - 聊天完成 API
import {
  getCorsHeaders,
  parseApiKey,
  getAccessToken,
  getModels,
  getIdentifier,
  getHighlightHeaders,
  formatMessagesToPrompt,
  formatOpenAITools,
  HIGHLIGHT_BASE_URL
} from '../../../lib/utils.js';

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

  if (!userInfo.user_id || !userInfo.client_uuid) {
    return new Response(JSON.stringify({ error: "Invalid authorization token - missing required fields" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      }
    });
  }

  try {
    const reqData = await request.json();

    const accessToken = await getAccessToken(userInfo.rt);
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
            let processedChunks = 0;
            const maxChunks = 100; // Vercel 限制更宽松

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              processedChunks++;
              if (processedChunks > maxChunks) {
                console.warn(`Processed ${maxChunks} chunks, stopping to avoid timeout`);
                break;
              }

              buffer += new TextDecoder().decode(value);

              // 使用正则表达式批量处理，提高效率
              const matches = buffer.match(/data: ({[^}]*"type":"text"[^}]*})/g);
              if (matches) {
                for (const match of matches) {
                  try {
                    const data = match.substring(6);
                    const eventData = JSON.parse(data);
                    if (eventData.type === "text" && eventData.content) {
                      const chunkData = {
                        id: responseId,
                        object: "chat.completion.chunk",
                        created: created,
                        model: reqData.model || "gpt-4o",
                        choices: [{
                          index: 0,
                          delta: { content: eventData.content },
                          finish_reason: null,
                        }],
                      };
                      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunkData)}\n\n`));
                    }
                  } catch {
                    // 忽略解析错误
                  }
                }
                // 清理已处理的内容
                buffer = buffer.substring(buffer.lastIndexOf('data: {'));
              }

              // 如果缓冲区太大，保留最后部分
              if (buffer.length > 8192) {
                const lastDataIndex = buffer.lastIndexOf('data: ');
                if (lastDataIndex > 0) {
                  buffer = buffer.substring(lastDataIndex);
                }
              }
            }

            // 发送完成消息
            const finalChunk = {
              id: responseId,
              object: "chat.completion.chunk",
              created: created,
              model: reqData.model || "gpt-4o",
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            };
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();

          } catch (error) {
            console.error('Streaming error:', error);
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
        },
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
    console.error('Chat completion error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      }
    });
  }
}