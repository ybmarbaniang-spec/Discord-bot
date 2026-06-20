module.exports = {
  name: 'compliment',
  description: 'Send a random compliment',
  async execute(message) {
    const compliments = ['You have a great sense of humor.','You are really courageous.','You light up the room.'];
    return message.channel.send(compliments[Math.floor(Math.random()*compliments.length)]);
  }
};
