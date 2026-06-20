const { getJson } = require('../lib/http');

module.exports = {
  name: 'trivia',
  description: 'Get a trivia question (Open Trivia DB)',
  async execute(message) {
    try {
      const j = await getJson('https://opentdb.com/api.php?amount=1&type=multiple');
      if (j && j.results && j.results.length) {
        const q = j.results[0];
        const choices = [q.correct_answer, ...q.incorrect_answers].sort(() => Math.random()-0.5);
        return message.channel.send(`Question: ${q.question}\nChoices: ${choices.map((c,i)=>`${i+1}. ${c}`).join('\n')}\nAnswer: ||${q.correct_answer}||`);
      }
      return message.reply('No trivia available.');
    } catch (err) {
      return message.reply('Failed to fetch trivia.');
    }
  }
};
