module.exports = {
  name: 'calc',
  description: 'Simple calculator (safe). Usage: !calc 2+2*3',
  async execute(message, args) {
    const expr = args.join(' ');
    if (!expr) return message.reply('Provide an expression.');
    // allow only numbers and +-*/(). and spaces
    if (!/^[0-9+\-*/(). %]+$/.test(expr)) return message.reply('Expression contains invalid characters.');
    try {
      // eslint-disable-next-line no-eval
      const res = eval(expr);
      return message.channel.send(`Result: ${res}`);
    } catch (err) { return message.reply('Failed to evaluate expression.'); }
  }
};
