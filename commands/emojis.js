module.exports = {
  name: 'emojis',
  description: 'List server emojis',
  async execute(message) {
    const list = message.guild.emojis.cache.map(e => `${e} ${e.name}`).join(' ');
    return message.channel.send(list || 'No emojis');
  }
};
