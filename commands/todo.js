const fs = require('fs');
const path = require('path');
const TODO_FILE = path.join(__dirname, '..', 'data', 'todos.json');
if (!fs.existsSync(path.dirname(TODO_FILE))) fs.mkdirSync(path.dirname(TODO_FILE), { recursive: true });
if (!fs.existsSync(TODO_FILE)) fs.writeFileSync(TODO_FILE, JSON.stringify({}), 'utf8');

function load() { return JSON.parse(fs.readFileSync(TODO_FILE,'utf8')||'{}'); }
function save(d){ fs.writeFileSync(TODO_FILE, JSON.stringify(d,null,2),'utf8'); }

module.exports = {
  name: 'todo',
  description: 'Simple todo: !todo add buy milk | !todo list | !todo rm 1',
  async execute(message, args) {
    const sub = (args[0]||'').toLowerCase();
    const data = load();
    const user = message.author.id;
    if (!data[user]) data[user]=[];
    if (sub === 'add') {
      const item = args.slice(1).join(' ');
      if (!item) return message.reply('Provide a todo item');
      data[user].push(item);
      save(data);
      return message.reply('Added todo.');
    } else if (sub === 'list') {
      const list = data[user];
      if (!list || !list.length) return message.reply('No todos');
      return message.channel.send(list.map((t,i)=>`${i+1}. ${t}`).join('\n'));
    } else if (sub === 'rm') {
      const i = parseInt(args[1],10)-1;
      if (isNaN(i) || i<0 || i>= (data[user]||[]).length) return message.reply('Invalid index');
      data[user].splice(i,1);
      save(data);
      return message.reply('Removed todo');
    }
    return message.reply('Usage: !todo add|list|rm');
  }
};
