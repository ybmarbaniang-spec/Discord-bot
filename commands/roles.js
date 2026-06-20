module.exports = {
  name: 'roles',
  description: 'List top roles',
  async execute(message) {
    const roles = message.guild.roles.cache
      .filter(r => r.id !== message.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => r.name)
      .slice(0, 20);
    return message.channel.send(`Roles (${roles.length} shown): ${roles.join(', ')}`);
  }
};
