const { getJson } = require('../lib/http');

module.exports = {
  name: 'cat',
  description: 'Random cat image (cataas)',
  async execute(message) {
    try {
      const j = await getJson('https://cataas.com/cat?json=true');
      if (j && j.url) return message.channel.send('https://cataas.com' + j.url);
      return message.reply('No cat image found.');
    } catch (err) {
      return message.reply('Failed to fetch cat image.');
    }
  }
};
