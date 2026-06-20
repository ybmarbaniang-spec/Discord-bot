module.exports = {
  name: 'ping',
  description: 'Check bot latency',
  async execute(message) {
    const sent = await message.channel.send('Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const api = Math.round(message.client.ws.ping);
    sent.edit(`Pong! Latency: ${latency}ms. API: ${api}ms`);
  }
};
