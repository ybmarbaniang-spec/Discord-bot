const { getJson } = require('../lib/http');

module.exports = {
  name: 'meme',
  description: 'Random meme from meme-api.com',
  async execute(message) {
    try {
      const j = await getJson('https://meme-api.com/gimme');
      if (j && j.url) return message.channel.send({ content: j.title + '\n' + j.url });
      return message.reply('No meme found.');
    } catch (err) {
      return message.reply('Failed to fetch a meme.');
    }
  }
};
