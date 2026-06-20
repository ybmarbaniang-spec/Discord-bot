const { getJson } = require('../lib/http');

module.exports = {
  name: 'joke',
  description: 'Fetch a random joke (Official Joke API)',
  async execute(message) {
    try {
      const j = await getJson('https://official-joke-api.appspot.com/random_joke');
      return message.channel.send(`${j.setup}\n${j.punchline}`);
    } catch (err) {
      return message.reply('Failed to fetch a joke.');
    }
  }
};
