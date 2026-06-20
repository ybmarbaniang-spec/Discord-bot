module.exports = {
  name: 'color',
  description: 'Convert hex to RGB: !color #ff0000',
  async execute(message, args) {
    const hex = (args[0]||'').replace('#','');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return message.reply('Provide a hex color like #ff0000');
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
    return message.channel.send(`RGB(${r}, ${g}, ${b})`);
  }
};
