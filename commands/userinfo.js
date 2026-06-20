const { EmbedBuilder } = require('discord.js');
const { formatDate } = require('../lib/utils');

module.exports = {
  name: 'userinfo',
  description: 'Show user information',
  async execute(message) {
    const member = message.mentions.members.first() || message.member;
    const user = member.user;
    const embed = new EmbedBuilder()
      .setAuthor({ name: `${user.tag}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Joined', value: formatDate(member.joinedTimestamp || 0), inline: true },
        { name: 'Created', value: formatDate(user.createdTimestamp), inline: true }
      );
    return message.channel.send({ embeds: [embed] });
  }
};
