module.exports = {
  name: 'softban',
  description: 'Softban (ban+unban) a member',
  async execute(message) {
    if (!message.member.permissions.has(require('discord.js').PermissionsBitField.Flags.BanMembers)) return message.reply('You need Ban Members permission.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('Mention a member to softban.');
    const reason = message.content.split(' ').slice(2).join(' ') || 'Softban';
    await member.ban({ deleteMessageDays: 1, reason }).catch(()=>{});
    await message.guild.members.unban(member.id).catch(()=>{});
    return message.reply(`${member.user.tag} softbanned.`);
  }
};
