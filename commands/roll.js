module.exports = {
  name: 'roll',
  description: 'Roll dice in NdM format (e.g., 2d6)',
  async execute(message, args) {
    const input = args[0] || '1d6';
    const m = input.match(/(\d+)d(\d+)/);
    if (!m) return message.reply('Invalid format. Use NdM like 2d6');
    const n = Math.min(100, parseInt(m[1],10));
    const sides = Math.min(1000, parseInt(m[2],10));
    const rolls = [];
    for (let i=0;i<n;i++) rolls.push(1+Math.floor(Math.random()*sides));
    return message.channel.send(`Rolled ${input}: ${rolls.join(', ')} (total ${rolls.reduce((a,b)=>a+b,0)})`);
  }
};
