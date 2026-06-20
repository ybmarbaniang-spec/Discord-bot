module.exports = {
  name: 'report',
  description: 'Report a user to moderators',
  async execute(message, args) {
    const reported = message.mentions.members.first();
    if (!reported) return message.reply('Mention a user to report.');
    const reason = args.join(' ') || 'No reason provided';
    const ch = message.guild.channels.cache.find(c => ['mod-log','reports','moderation'].includes(c.name));
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setTitle('User Report')
      .addFields(
        { name: 'Reported', value: `${reported.user.tag} (${reported.id})` },
        { name: 'Reporter', value: `${message.author.tag} (${message.author.id})` },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();
    if (ch && ch.isTextBased && ch.isTextBased()) {
      ch.send({ embeds: [embed] });
      message.reply('Your report was submitted to the moderation channel.');
    } else {
      try {
        await message.guild.fetchOwner().then(owner => owner.send({ embeds: [embed] }));
        message.reply('No mod channel found — report sent to server owner.');
      } catch (err) {
        message.reply('Could not send report to moderators.');
      }
    }
  }
};
