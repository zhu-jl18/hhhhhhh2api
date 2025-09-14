// Vercel Node.js Functions - 主页重定向
const { handleCors } = require('./lib/utils');

module.exports = async function handler(req, res) {
  // 处理 CORS
  if (handleCors(req, res)) {
    return; // OPTIONS 请求已处理
  }

  // 重定向到静态 HTML 文件
  return res.redirect(302, '/index.html');
};