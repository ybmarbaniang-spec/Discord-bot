const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WARNS_FILE = path.join(DATA_DIR, 'warns.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(WARNS_FILE)) fs.writeFileSync(WARNS_FILE, JSON.stringify({}), 'utf8');

function loadWarns() {
  try {
    return JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read warns.json, resetting:', err);
    fs.writeFileSync(WARNS_FILE, JSON.stringify({}), 'utf8');
    return {};
  }
}
function saveWarns(data) {
  fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { loadWarns, saveWarns };
