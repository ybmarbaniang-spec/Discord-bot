module.exports = {
  name: 'timer',
  description: 'Start a simple timer: !timer 10s or 1m',
  async execute(message, args) {
    const t = args[0];
    if (!t) return message.reply('Provide a duration like 10s or 1m or 1h');
    const m = t.match(/(\d+)([smh])/);
    if (!m) return message.reply('Invalid duration');
    const val = parseInt(m[1],10); const unit = m[2];
    let ms = val * (unit==='s'?1000: unit==='m'?60000:3600000);
    message.reply(`Timer started for ${t}`);
    setTimeout(()=> message.channel.send(`${message.author}, your ${t} timer is up!`), ms);
  }
};
