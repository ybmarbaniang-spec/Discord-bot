const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'avatar',
  description: 'Show user avatar',
  async execute(message) {
    const user = message.mentions.users.first() || message.author;
    return message.channel.send({ content: user.displayAvatarURL({ dynamic: true, size: 1024 }) });
  }
};
