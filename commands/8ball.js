module.exports = {
  name: '8ball',
  description: 'Ask the magic 8-ball',
  async execute(message, args) {
    const q = args.join(' ');
    if (!q) return message.reply('Ask a question.');
    const answers = ['Yes.','No.','Maybe.','Ask again later.','Definitely.','I don\'t think so.','Absolutely.','Uncertain.'];
    return message.channel.send(answers[Math.floor(Math.random()*answers.length)]);
  }
};
