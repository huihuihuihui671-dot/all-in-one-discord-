import {
    Client,
    Events,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    GuildMember
} from 'discord.js';
import { env } from '../config/env';
import { BotConfig } from '../config/bot';
import { Logger } from '../services/logger.service';
import { getMemberHighestTier, canModerateTarget } from '../security/permissions';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 1. Define command structures for registration
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong and shows bot latency!'),

    new SlashCommandBuilder()
        .setName('checkperm')
        .setDescription('Checks the staff hierarchy tier and permissions of a member.')
        .addUserOption((option) =>
            option
                .setName('target')
                .setDescription('The user to evaluate (leave empty to check yourself)')
                .setRequired(false)
        )
].map((command) => command.toJSON());

// 2. ClientReady event replaces deprecated "ready" event
client.once(Events.ClientReady, async () => {
    Logger.info(`Logged in successfully as ${client.user?.tag}!`);
    Logger.info(`Loaded primary color: ${BotConfig.colors.primary}`);

    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
    try {
        Logger.info('Registering slash commands (/ping, /checkperm)...');
        await rest.put(
            Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
            { body: commands }
        );
        Logger.info('Commands registered successfully!');
    } catch (error) {
        Logger.error('Failed to register commands:', error);
    }
});

// 3. Command interaction router
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        Logger.info(`${interaction.user.tag} used /ping in${interaction.guild?.name}`);
        await interaction.reply(`🏓 Pong!\nLatency: \`${latency}ms\``);
        return;
    }

    if (commandName === 'checkperm') {
        if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
            await interaction.reply({
                content: 'This command can only be executed inside a server.',
                ephemeral: true
            });
            return;
        }

        const targetUser = interaction.options.getUser('target');
        const targetMember = targetUser
            ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
            : interaction.member;

        if (!targetMember) {
            await interaction.reply({
                content: 'Unable to locate the specified member in this server.',
                ephemeral: true
            });
            return;
        }

        const evaluation = getMemberHighestTier(targetMember);
        const hierarchyComparison = canModerateTarget(interaction.member, targetMember);

        let response = `🛡️ **Permission Analysis for ${targetMember.user.tag}**:\n`;
        response += `• **Assigned Tier**: Level \`${evaluation.tier}\` (${evaluation.tierName})\n`;
        response += `• **Server Owner**: ${targetMember.id === interaction.guild.ownerId ? 'Yes' : 'No'}\n`;
        response += `• **Administrator Right**: ${targetMember.permissions.has('Administrator') ? 'Yes' : 'No'}\n\n`;

        if (interaction.member.id !== targetMember.id) {
            response += `⚖️ **Moderation Hierarchy Check**:\n`;
            response += hierarchyComparison.allowed
                ? `✅ You have sufficient authority to moderate this user.`
                : `❌ You cannot moderate this user: *${hierarchyComparison.reason}*`;
        }

        Logger.security(`${interaction.user.tag} executed /checkperm on ${targetMember.user.tag}`);
        await interaction.reply({ content: response, ephemeral: true });
    }
});

client.login(env.DISCORD_TOKEN);