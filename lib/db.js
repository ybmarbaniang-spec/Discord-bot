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

  db.prepare(`CREATE TABLE IF NOT EXISTS settings (
    guild_id TEXT PRIMARY KEY,
    prefix TEXT,
    modlog_channel_id TEXT
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

function setPrefix(guildId, prefix) {
  const stmt = db.prepare('INSERT INTO settings (guild_id,prefix) VALUES (?,?) ON CONFLICT(guild_id) DO UPDATE SET prefix = excluded.prefix');
  stmt.run(guildId, prefix);
}

function getPrefix(guildId) {
  const row = db.prepare('SELECT prefix FROM settings WHERE guild_id = ?').get(guildId);
  return row ? row.prefix : null;
}

function setModLog(guildId, channelId) {
  const stmt = db.prepare('INSERT INTO settings (guild_id,modlog_channel_id) VALUES (?,?) ON CONFLICT(guild_id) DO UPDATE SET modlog_channel_id = excluded.modlog_channel_id');
  stmt.run(guildId, channelId);
}

function getModLog(guildId) {
  const row = db.prepare('SELECT modlog_channel_id FROM settings WHERE guild_id = ?').get(guildId);
  return row ? row.modlog_channel_id : null;
}

module.exports = { init, addWarn, getWarns, clearWarns, addTempAction, getPendingTempActions, getDueTempActions, removeTempAction, setPrefix, getPrefix, setModLog, getModLog };
