const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'bot.log');

function timestamp() {
  return new Date().toISOString();
}

function write(line) {
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

function info(...args) {
  const line = `[INFO] [${timestamp()}] ` + args.map(format).join(' ');
  console.log(line);
  write(line);
}

function error(...args) {
  const line = `[ERROR] [${timestamp()}] ` + args.map(format).join(' ');
  console.error(line);
  write(line);
}

function format(x) {
  if (typeof x === 'string') return x;
  try { return JSON.stringify(x); } catch (e) { return String(x); }
}

module.exports = { info, error };
