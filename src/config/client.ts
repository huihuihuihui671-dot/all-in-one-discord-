import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { env } from '../config/env'; // Importing our secure passwords
import { BotConfig } from '../config/bot'; // Importing our bot settings

// 1. Create the bot client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 2. This runs exactly ONE time when the bot successfully logs in
client.once('ready', async () => {
    console.log(`✅ Logged in successfully as ${client.user?.tag}!`);
    console.log(`🎨 Loaded primary color: ${BotConfig.colors.primary}`);

    // Registering the /ping command using our safe env variables
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
    try {
        console.log('⏳ Registering /ping command...');
        await rest.put(
            Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
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

// 3. This runs EVERY time someone uses a slash command
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`🏓 Pong!\nLatency: \`${latency}ms\``);
    }
});

// 4. Log in using our safe token
client.login(env.DISCORD_TOKEN);