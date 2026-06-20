const { getJson } = require('../lib/http');

module.exports = {
  name: 'dog',
  description: 'Random dog image (dog.ceo)',
  async execute(message) {
    try {
      const j = await getJson('https://dog.ceo/api/breeds/image/random');
      if (j && j.status === 'success') return message.channel.send(j.message);
      return message.reply('No dog image found.');
    } catch (err) {
      return message.reply('Failed to fetch dog image.');
    }
  }
};
