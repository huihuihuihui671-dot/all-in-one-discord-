import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { env } from '../config/env';
import { BotConfig } from '../config/bot';
import { Logger } from '../services/logger.service'; // IMPORTING OUR NEW LOGGER

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', async () => {
    // Replaced console.log with Logger.info
    Logger.info(`Logged in successfully as ${client.user?.tag}!`);
    Logger.info(`Loaded primary color: ${BotConfig.colors.primary}`);

    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
    try {
        Logger.info('Registering /ping command...');
        await rest.put(
            Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
            { 
                body: [{ 
                    name: 'ping', 
                    description: 'Replies with Pong and shows bot latency!' 
                }] 
            }
        );
        Logger.info('Command registered successfully!');
    } catch (error) {
        // Replaced console.error with Logger.error
        Logger.error('Failed to register command:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        
        // NEW: Log an audit trail of the command usage
        Logger.info(`${interaction.user.tag} used /ping in server:${interaction.guild?.name}`);
        
        await interaction.reply(`🏓 Pong!\nLatency: \`${latency}ms\``);
    }
});

client.login(env.DISCORD_TOKEN);