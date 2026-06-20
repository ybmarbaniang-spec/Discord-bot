// poll command
const { EmbedBuilder } = require('discord.js');
module.exports = {
  name: 'poll',
  description: 'Create a quick poll',
  async execute(message) {
    const prefix = require('../index').PREFIX || '!';
    const content = message.content.slice(prefix.length + 'poll'.length).trim();
    const match = content.match(/"([^"]+)"\s*(.+)/);
    if (!match) return message.reply('Usage: !poll "Question" option1 | option2 | option3');
    const question = match[1];
    const opts = match[2].split('|').map(o => o.trim()).filter(Boolean).slice(0, 10);
    if (opts.length < 2) return message.reply('Provide at least 2 options.');
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    const embed = new EmbedBuilder().setTitle(question).setDescription(opts.map((o, i) => `${emojis[i]} ${o}`).join('\n'));
    const poll = await message.channel.send({ embeds: [embed] });
    for (let i = 0; i < opts.length; i++) await poll.react(emojis[i]);
  }
};
