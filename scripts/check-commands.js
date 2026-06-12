const fs = require('fs');
const path = require('path');

const commandsPath = path.join(__dirname, '..', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (!command.data || !command.execute) {
    throw new Error(`${file} nao exporta data e execute.`);
  }
}

console.log(`${commandFiles.length} comandos validados.`);
