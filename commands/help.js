const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'help',
  description: 'Show help and commands',
  async execute(message, args, client, ctx) {
    const cmds = Array.from(ctx.commands.values()).map(c => `
	[0m${c.name} - ${c.description || ''}`);
    const embed = new EmbedBuilder()
      .setTitle('Help — Commands')
      .setDescription(`Prefix: ${ctx.PREFIX}`)
      .addFields(
        { name: 'Commands (sample)', value: cmds.slice(0, 25).map(s => s.trim()).join('\n') || 'No commands found' }
      );
    return message.channel.send({ embeds: [embed] });
  }
};
