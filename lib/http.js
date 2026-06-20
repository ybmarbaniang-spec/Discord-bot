const https = require('https');

function getJson(url) {
  return new Promise((resolve, reject) => {
    try {
      const req = https.get(url, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (err) { reject(err); }
        });
      });
      req.on('error', reject);
      req.end();
    } catch (err) { reject(err); }
  });
}

function getBuffer(url) {
  return new Promise((resolve, reject) => {
    try {
      https.get(url, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    } catch (err) { reject(err); }
  });
}

module.exports = { getJson, getBuffer };
