const { HIGHLIGHT_BASE_URL, parseApiKey, getAccessToken, getHighlightHeaders } = require('../../../lib/auth');
const { formatMessagesToPrompt, formatOpenAITools, handleCors } = require('../../../lib/utils');
const { getIdentifier } = require('../../../lib/crypto');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization token' });

    const token = authHeader.substring(7);
    const userInfo = parseApiKey(token);
    if (!userInfo || !userInfo.rt) return res.status(401).json({ error: 'Invalid authorization token' });
    if (!userInfo.user_id || !userInfo.client_uuid) return res.status(401).json({ error: 'Invalid authorization token - missing required fields' });

    const reqData = req.body || {};
    const accessToken = await getAccessToken(userInfo.rt);

    const highlightHeaders = getHighlightHeaders(accessToken, await getIdentifier(userInfo.user_id, userInfo.client_uuid));

    const prompt = formatMessagesToPrompt(reqData.messages || []);
    const tools = formatOpenAITools(reqData.tools || []);

    let modelId = reqData.model || 'gpt-4o';
    const modelResolve = async () => {
      try {
        const r = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/models`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!r.ok) return null;
        const j = await r.json();
        if (!j.success) return null;
        const found = j.data.find(m => m.name === modelId);
        return found ? found.id : null;
      } catch { return null; }
    };

    const modelResolvedId = await modelResolve();
    if (!modelResolvedId) return res.status(400).json({ error: `Model '${modelId}' not found` });

    const highlightData = {
      prompt,
      attachedContext: [],
      modelId: modelResolvedId,
      additionalTools: tools,
      backendPlugins: [],
      useMemory: false,
      useKnowledge: false,
      ephemeral: false,
      timezone: 'Asia/Hong_Kong',
    };

    if (reqData.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const upstream = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, {
        method: 'POST',
        headers: highlightHeaders,
        body: JSON.stringify(highlightData),
      });

      if (!upstream.ok) {
        res.write(`data: ${JSON.stringify({ error: { message: `Highlight API returned status code ${upstream.status}`, type: 'api_error' } })}\n\n`);
        return res.end();
      }

      const responseId = `chatcmpl-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      res.write(`data: ${JSON.stringify({ id: responseId, object: 'chat.completion.chunk', created, model: modelId, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })}\n\n`);

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value);
          while (buffer.includes('\n')) {
            const lineEnd = buffer.indexOf('\n');
            const line = buffer.slice(0, lineEnd);
            buffer = buffer.slice(lineEnd + 1);
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (!data) continue;
              try {
                const ev = JSON.parse(data);
                if (ev.type === 'text' && ev.content) {
                  res.write(`data: ${JSON.stringify({ id: responseId, object: 'chat.completion.chunk', created, model: modelId, choices: [{ index: 0, delta: { content: ev.content }, finish_reason: null }] })}\n\n`);
                }
              } catch {}
            }
          }
        }
        res.write(`data: ${JSON.stringify({ id: responseId, object: 'chat.completion.chunk', created, model: modelId, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      };

      pump();
      return;
    }

    const upstream = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, {
      method: 'POST',
      headers: highlightHeaders,
      body: JSON.stringify(highlightData),
    });

    if (!upstream.ok) return res.status(upstream.status).json({ error: { message: `Highlight API returned status code ${upstream.status}`, type: 'api_error' } });

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      while (buffer.includes('\n')) {
        const lineEnd = buffer.indexOf('\n');
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 1);
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const ev = JSON.parse(data);
            if (ev.type === 'text' && ev.content) full += ev.content;
          } catch {}
        }
      }
    }

    const responseId = `chatcmpl-${Date.now()}`;
    return res.status(200).json({
      id: responseId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelId,
      choices: [{ index: 0, message: { role: 'assistant', content: full }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};