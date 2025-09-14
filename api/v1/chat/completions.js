// Vercel Node.js Functions - 聊天完成 API
const { HIGHLIGHT_BASE_URL, USER_AGENT, parseApiKey, getAccessToken, getHighlightHeaders } = require('../../lib/auth');
const { handleCors, formatMessagesToPrompt, formatOpenAITools, generateUUID } = require('../../lib/utils');
const { getIdentifier } = require('../../lib/crypto');

async function getModels(accessToken) {
  const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/models`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get models");
  }

  const respJson = await response.json();
  if (!respJson.success) {
    throw new Error("Failed to get models data");
  }

  const models = new Map();
  for (const model of respJson.data) {
    models.set(model.name, model);
  }

  return models;
}

module.exports = async function handler(req, res) {
  // 处理 CORS
  if (handleCors(req, res)) {
    return; // OPTIONS 请求已处理
  }

  // 只处理 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 验证token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const token = authHeader.substring(7);
    const userInfo = parseApiKey(token);

    if (!userInfo || !userInfo.rt) {
      return res.status(401).json({ error: "Invalid authorization token" });
    }

    if (!userInfo.user_id || !userInfo.client_uuid) {
      return res.status(401).json({ error: "Invalid authorization token - missing required fields" });
    }

    const reqData = req.body;
    const accessToken = await getAccessToken(userInfo.rt);
    const models = await getModels(accessToken);
    const modelInfo = models.get(reqData.model || "gpt-4o");

    if (!modelInfo) {
      return res.status(400).json({ error: `Model '${reqData.model || "gpt-4o"}' not found` });
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
      // 流式响应 - 设置SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

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

        // 处理流式响应
        const reader = response.body.getReader();
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
                  const parsed = JSON.parse(data);
                  if (parsed.type === "content" && parsed.content) {
                    const chunk = {
                      id: responseId,
                      object: "chat.completion.chunk",
                      created: created,
                      model: reqData.model || "gpt-4o",
                      choices: [{
                        index: 0,
                        delta: { content: parsed.content },
                        finish_reason: null,
                      }],
                    };
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                  } else if (parsed.type === "end") {
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
                    return res.end();
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          }
        }

        res.write("data: [DONE]\n\n");
        return res.end();

      } catch (error) {
        res.write(`data: ${JSON.stringify({
          error: { message: error.message, type: "api_error" }
        })}\n\n`);
        return res.end();
      }

    } else {
      // 非流式响应
      const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(highlightData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: `Highlight API error: ${response.status} - ${errorText}`
        });
      }

      // 收集完整响应
      let fullContent = "";
      const reader = response.body.getReader();
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
                const parsed = JSON.parse(data);
                if (parsed.type === "content" && parsed.content) {
                  fullContent += parsed.content;
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }

      return res.status(200).json({
        id: `chatcmpl-${generateUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: reqData.model || "gpt-4o",
        choices: [{
          index: 0,
          message: { role: "assistant", content: fullContent },
          finish_reason: "stop",
        }],
        usage: {
          prompt_tokens: prompt.length,
          completion_tokens: fullContent.length,
          total_tokens: prompt.length + fullContent.length,
        },
      });
    }

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};