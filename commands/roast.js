module.exports = {
  name: 'roast',
  description: 'Send a light-hearted roast',
  async execute(message) {
    const roasts = ['I\'d agree with you but then we\'d both be wrong.','You have the right to remain silent because whatever you say will probably be stupid anyway.','If I wanted to kill myself, I\'d climb your ego and jump to your IQ.'];
    return message.channel.send(roasts[Math.floor(Math.random()*roasts.length)]);
  }
};
