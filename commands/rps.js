module.exports = {
  name: 'rps',
  description: 'Play rock-paper-scissors: !rps rock',
  async execute(message, args) {
    const pick = (args[0] || '').toLowerCase();
    const options = ['rock','paper','scissors'];
    if (!options.includes(pick)) return message.reply('Choose rock, paper, or scissors');
    const bot = options[Math.floor(Math.random()*3)];
    const win = (a,b) => (a==='rock'&&b==='scissors')||(a==='scissors'&&b==='paper')||(a==='paper'&&b==='rock');
    let result = 'Draw!';
    if (win(pick,bot)) result = 'You win!';
    else if (win(bot,pick)) result = 'You lose!';
    return message.channel.send(`You: ${pick} — Bot: ${bot} — ${result}`);
  }
};
