const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_FILE = process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'bot.db');

let db;

function init() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');

  db.prepare(`CREATE TABLE IF NOT EXISTS warns (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator TEXT,
    reason TEXT,
    timestamp INTEGER
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS temp_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    reason TEXT
  )`).run();
}

function addWarn(guildId, userId, moderator, reason, timestamp=Date.now()) {
  const stmt = db.prepare('INSERT INTO warns (guild_id,user_id,moderator,reason,timestamp) VALUES (?,?,?,?,?)');
  stmt.run(guildId, userId, moderator, reason, timestamp);
}

function getWarns(guildId, userId) {
  const stmt = db.prepare('SELECT moderator,reason,timestamp FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC');
  return stmt.all(guildId, userId);
}

function clearWarns(guildId, userId) {
  const stmt = db.prepare('DELETE FROM warns WHERE guild_id = ? AND user_id = ?');
  stmt.run(guildId, userId);
}

function addTempAction(guildId, userId, action, expiresAt, reason='') {
  const stmt = db.prepare('INSERT INTO temp_actions (guild_id,user_id,action,expires_at,reason) VALUES (?,?,?,?,?)');
  const info = stmt.run(guildId, userId, action, expiresAt, reason);
  return info.lastInsertRowid;
}

function getPendingTempActions(now = Date.now()) {
  const stmt = db.prepare('SELECT id,guild_id,user_id,action,expires_at,reason FROM temp_actions WHERE expires_at > ? ORDER BY expires_at ASC');
  return stmt.all(now);
}

function getDueTempActions(now = Date.now()) {
  const stmt = db.prepare('SELECT id,guild_id,user_id,action,expires_at,reason FROM temp_actions WHERE expires_at <= ? ORDER BY expires_at ASC');
  return stmt.all(now);
}

function removeTempAction(id) {
  const stmt = db.prepare('DELETE FROM temp_actions WHERE id = ?');
  stmt.run(id);
}

module.exports = { init, addWarn, getWarns, clearWarns, addTempAction, getPendingTempActions, getDueTempActions, removeTempAction };
