module.exports = {
  name: 'remind',
  description: 'Set a reminder: !remind 10m text',
  async execute(message, args) {
    const dur = args[0];
    const text = args.slice(1).join(' ');
    if (!dur || !text) return message.reply('Usage: !remind 10m message');
    const m = dur.match(/(\d+)([smhd])/);
    if (!m) return message.reply('Invalid duration');
    const v = parseInt(m[1],10); const u = m[2];
    const ms = v * (u==='s'?1000: u==='m'?60000: u==='h'?3600000: u==='d'?86400000:1000);
    message.reply(`Okay, I'll remind you in ${dur}`);
    setTimeout(()=>{ message.author.send(`Reminder: ${text}`).catch(()=>{}); }, ms);
  }
};
