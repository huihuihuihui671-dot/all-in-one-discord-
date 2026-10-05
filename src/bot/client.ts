import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from 'dotenv';

// 1. Load the hidden .env file that contains our secret passwords
config();

// 2. Grab our secrets from the environment
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

// 3. Safety check: Stop the bot if we forgot to set our passwords
if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error("❌ CRITICAL ERROR: Missing environment variables! Please check your .env file.");
    process.exit(1);
}

// 4. Create the bot client. "Intents" tell Discord what information we want to see.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 5. This runs exactly ONE time when the bot successfully logs in
client.once('ready', async () => {
    console.log(`✅ Logged in successfully as ${client.user?.tag}!`);

    // Let's create the /ping command on Discord
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('⏳ Registering /ping command...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { 
                body: [{ 
                    name: 'ping', 
                    description: 'Replies with Pong and shows bot latency!' 
                }] 
            }
        );
        console.log('✅ Command registered successfully!');
    } catch (error) {
        console.error('❌ Failed to register command:', error);
    }
});

// 6. This runs EVERY time someone uses a slash command
client.on('interactionCreate', async (interaction) => {
    // If it's not a slash command, ignore it
    if (!interaction.isChatInputCommand()) return;

    // Check if the command used was /ping
    if (interaction.commandName === 'ping') {
        // Calculate how long it took to receive the message
        const latency = Date.now() - interaction.createdTimestamp;
        
        // Reply to the user
        await interaction.reply(`🏓 Pong!\nLatency: \`${latency}ms\``);
    }
});

// 7. Finally, log in using our secret token
client.login(TOKEN);