module.exports = {
  name: 'stats',
  description: 'Show bot stats',
  async execute(message) {
    const client = message.client;
    return message.channel.send(`Guilds: ${client.guilds.cache.size} — Users cached: ${client.users.cache.size}`);
  }
};
