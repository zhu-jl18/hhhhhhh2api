function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
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

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return false; // 继续处理请求
}

module.exports = {
  generateUUID,
  getCorsHeaders,
  formatMessagesToPrompt,
  formatOpenAITools,
  handleCors
};