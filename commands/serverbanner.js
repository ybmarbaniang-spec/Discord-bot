module.exports = {
  name: 'serverbanner',
  description: 'Show server banner',
  async execute(message) {
    const g = message.guild;
    if (!g.bannerURL) return message.reply('No banner set');
    return message.channel.send({ content: g.bannerURL({ size: 1024 }) });
  }
};
