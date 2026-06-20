module.exports = {
  name: 'quote',
  description: 'Random inspirational quote',
  async execute(message) {
    const quotes = [
      'Be yourself; everyone else is already taken. — Oscar Wilde',
      'Do not take life too seriously. You will never get out of it alive. — Elbert Hubbard',
      'In the end, we will remember not the words of our enemies, but the silence of our friends. — Martin Luther King Jr.'
    ];
    return message.channel.send(quotes[Math.floor(Math.random()*quotes.length)]);
  }
};
