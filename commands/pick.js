module.exports = {
  name: 'pick',
  description: 'Pick a random item: !pick a|b|c',
  async execute(message) {
    const content = message.content.split(' ').slice(1).join(' ');
    if (!content) return message.reply('Provide items separated by |');
    const parts = content.split('|').map(s=>s.trim()).filter(Boolean);
    if (!parts.length) return message.reply('No items provided');
    return message.channel.send(parts[Math.floor(Math.random()*parts.length)]);
  }
};
