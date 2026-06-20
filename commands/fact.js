module.exports = {
  name: 'fact',
  description: 'Random fact',
  async execute(message) {
    const facts = ['Honey never spoils.','Bananas are berries but strawberries are not.','Octopuses have three hearts.'];
    return message.channel.send(facts[Math.floor(Math.random()*facts.length)]);
  }
};
