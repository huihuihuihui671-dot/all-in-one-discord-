import {
    Client,
    Events,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    GuildMember,
    PermissionFlagsBits
} from 'discord.js';
import { env } from '../config/env';
import { BotConfig } from '../config/bot';
import { Logger } from '../services/logger.service';
import { getMemberHighestTier, canModerateTarget } from '../security/permissions';
import { ModerationService } from '../services/moderation.service';
import { AntiSpam } from '../security/antispam'; // NEW: Import our security guard

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // Critical for seeing what people type
    ]
});

const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong and shows bot latency!'),
    new SlashCommandBuilder().setName('checkperm').setDescription('Checks the staff hierarchy tier.').addUserOption(o => o.setName('target').setDescription('User to check')),
    new SlashCommandBuilder().setName('warn').setDescription('Issue a formal warning.').addUserOption(o => o.setName('target').setDescription('User').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    new SlashCommandBuilder().setName('kick').setDescription('Kick a member.').addUserOption(o => o.setName('target').setDescription('User').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
].map(c => c.toJSON());

client.once(Events.ClientReady, async () => {
    Logger.info(`Logged in successfully as ${client.user?.tag}!`);
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), { body: commands });
    } catch (error) {
        Logger.error('Failed to register commands:', error);
    }
});

// NEW: Watch every single message sent in the server
client.on(Events.MessageCreate, async (message) => {
    // Pass the message to our Anti-Spam engine for analysis
    await AntiSpam.analyze(message);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply({ content: `🏓 Pong! Latency: \`${latency}ms\``, ephemeral: true });
    }

    if (commandName === 'checkperm') {
        if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
        const targetUser = interaction.options.getUser('target') || interaction.user;
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) return interaction.reply({ content: 'Member not found.', ephemeral: true });

        const evaluation = getMemberHighestTier(targetMember);
        const hierarchy = canModerateTarget(interaction.member, targetMember);
        let response = `🛡️ **Tier**: Level \`${evaluation.tier}\` (${evaluation.tierName})\n`;
        if (interaction.member.id !== targetMember.id) {
            response += hierarchy.allowed ? `✅ You outrank this user.` : `❌ You cannot moderate this user.`;
        }
        await interaction.reply({ content: response, ephemeral: true });
    }

    if (commandName === 'warn' || commandName === 'kick') {
        if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
        const targetUser = interaction.options.getUser('target', true);
        const reason = interaction.options.getString('reason', true);
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        
        if (!targetMember) return interaction.reply({ content: '❌ Not in server.', ephemeral: true });

        const hierarchy = canModerateTarget(interaction.member, targetMember);
        if (!hierarchy.allowed) return interaction.reply({ content: `❌ **Denied**: ${hierarchy.reason}`, ephemeral: true });

        if (commandName === 'warn') {
            await ModerationService.logInfraction(interaction.guild.id, targetMember.id, interaction.user.id, 'WARN', reason);
            await targetMember.send(`⚠️ You were **warned** in ${interaction.guild.name} for: \`${reason}\``).catch(() => null);
            await interaction.reply({ content: `✅ **${targetUser.tag}** warned.\nReason: \`${reason}\`` });
        }

        if (commandName === 'kick') {
            if (!targetMember.kickable) return interaction.reply({ content: `❌ My role is too low to kick them.`, ephemeral: true });
            await ModerationService.logInfraction(interaction.guild.id, targetMember.id, interaction.user.id, 'KICK', reason);
            await targetMember.send(`🔨 You were **kicked** from ${interaction.guild.name} for: \`${reason}\``).catch(() => null);
            await targetMember.kick(reason);
            await interaction.reply({ content: `✅ **${targetUser.tag}** kicked.\nReason: \`${reason}\`` });
        }
    }
});

client.login(env.DISCORD_TOKEN);