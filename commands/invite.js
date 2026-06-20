module.exports = {
  name: 'invite',
  description: 'Get bot invite link',
  async execute(message) {
    const client = message.client;
    return message.channel.send(`Invite: https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot%20applications.commands&permissions=8`);
  }
};
