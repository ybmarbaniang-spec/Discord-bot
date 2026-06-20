// Deprecated JSON warns replaced with sqlite-backed API
const db = require('./db');

function loadWarnsFor(guildId, userId) {
  return db.getWarns(guildId, userId) || [];
}

function addWarn(guildId, userId, moderator, reason) {
  db.addWarn(guildId, userId, moderator, reason);
}

function clearWarns(guildId, userId) {
  db.clearWarns(guildId, userId);
}

module.exports = { loadWarnsFor, addWarn, clearWarns };
