module.exports = {
  name: 'members',
  description: 'Show member count',
  async execute(message) {
    return message.channel.send(`Members: ${message.guild.memberCount}`);
  }
};
