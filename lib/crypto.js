const crypto = require('crypto');

// 原始加密常量
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
  const crypto = require('crypto');
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

function H7t(t = 12) {
  const crypto = require('crypto');
  const randomBytes = crypto.randomBytes(t);
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getIdentifier(userId, clientUUID, fixedIv) {
  const t = await kh({ userId, clientUUID }, fixedIv);
  const randomHex = H7t();
  return `${randomHex}:${t}`;
}

module.exports = {
  Hr,
  jr,
  Ah,
  Fl,
  pbkdf2,
  Th,
  kh,
  H7t,
  getIdentifier
};