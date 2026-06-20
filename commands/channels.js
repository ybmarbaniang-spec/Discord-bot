module.exports = {
  name: 'channels',
  description: 'List text channels',
  async execute(message) {
    const list = message.guild.channels.cache.filter(c => c.isTextBased && c.isTextBased()).map(c => `${c.name} (${c.id})`).join('\n');
    return message.channel.send(`Channels:\n${list}`);
  }
};
