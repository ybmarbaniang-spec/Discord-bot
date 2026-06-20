const { EmbedBuilder } = require('discord.js');
const { loadWarns } = require('../lib/warns');
const { formatDate } = require('../lib/utils');

module.exports = {
  name: 'warnings',
  description: 'Show warnings for a user',
  async execute(message) {
    const user = message.mentions.users.first() || message.author;
    const warns = loadWarns();
    const list = (warns[message.guild.id] && warns[message.guild.id][user.id]) || [];
    if (!list.length) return message.channel.send(`${user.tag} has no warnings.`);
    const out = list.map((w, i) => `${i+1}. by <@${w.moderator}> on ${formatDate(w.timestamp)} — ${w.reason}`).join('\n');
    const embed = new EmbedBuilder().setTitle(`Warnings for ${user.tag}`).setDescription(out);
    return message.channel.send({ embeds: [embed] });
  }
};
