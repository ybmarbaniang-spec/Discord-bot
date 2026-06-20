module.exports = {
  name: 'coin',
  description: 'Flip a coin',
  async execute(message) {
    return message.channel.send(Math.random() < 0.5 ? 'Heads' : 'Tails');
  }
};
