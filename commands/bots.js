module.exports = {
  name: 'bots',
  description: 'Show bot count in this guild',
  async execute(message) {
    const bots = message.guild.members.cache.filter(m => m.user.bot).size;
    return message.channel.send(`Bots in server: ${bots}`);
  }
};
