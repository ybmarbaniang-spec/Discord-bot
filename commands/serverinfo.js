const { EmbedBuilder } = require('discord.js');
const { formatDate } = require('../lib/utils');

module.exports = {
  name: 'serverinfo',
  description: 'Show server information',
  async execute(message) {
    const g = message.guild;
    const embed = new EmbedBuilder()
      .setTitle(`${g.name} — Info`)
      .setThumbnail(g.iconURL({ dynamic: true }))
      .addFields(
        { name: 'ID', value: g.id, inline: true },
        { name: 'Members', value: `${g.memberCount}`, inline: true },
        { name: 'Created', value: formatDate(g.createdTimestamp), inline: true }
      )
      .setFooter({ text: `Locale: ${g.preferredLocale || 'unknown'}` });
    return message.channel.send({ embeds: [embed] });
  }
};
