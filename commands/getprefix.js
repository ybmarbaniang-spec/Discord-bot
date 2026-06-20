module.exports = {
  name: 'getprefix',
  description: 'Get server prefix',
  async execute(message) {
    const p = require('../lib/db').getPrefix(message.guild.id) || process.env.PREFIX || '!';
    return message.reply(`Server prefix: ${p}`);
  }
};
