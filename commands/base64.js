module.exports = {
  name: 'base64',
  description: 'Encode or decode base64: !base64 encode text OR !base64 decode text',
  async execute(message, args) {
    const mode = (args[0]||'').toLowerCase();
    const rest = args.slice(1).join(' ');
    if (!mode || !rest) return message.reply('Usage: !base64 encode|decode text');
    if (mode === 'encode') return message.channel.send(Buffer.from(rest, 'utf8').toString('base64'));
    if (mode === 'decode') return message.channel.send(Buffer.from(rest, 'base64').toString('utf8'));
    return message.reply('Unknown mode; use encode or decode');
  }
};
