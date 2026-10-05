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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 1. Define all our slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong and shows bot latency!'),

    new SlashCommandBuilder()
        .setName('checkperm')
        .setDescription('Checks the staff hierarchy tier and permissions of a member.')
        .addUserOption((option) =>
            option.setName('target').setDescription('The user to evaluate').setRequired(false)
        ),
        
    // NEW: Warn Command
    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a formal warning to a member.')
        .addUserOption((option) => 
            option.setName('target').setDescription('The user to warn').setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('reason').setDescription('The reason for the warning').setRequired(true)
        )
        // Discord's built-in block: Only show this command to people with Kick Members permission
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
        
    // NEW: Kick Command
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server.')
        .addUserOption((option) => 
            option.setName('target').setDescription('The user to kick').setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('reason').setDescription('The reason for the kick').setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
].map((command) => command.toJSON());

client.once(Events.ClientReady, async () => {
    Logger.info(`Logged in successfully as ${client.user?.tag}!`);
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
            { body: commands }
        );
        Logger.info('All moderation commands registered successfully!');
    } catch (error) {
        Logger.error('Failed to register commands:', error);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // --- PING ---
    if (commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply({ content: `🏓 Pong! Latency: \`${latency}ms\``, ephemeral: true });
        return;
    }

    // --- CHECKPERM ---
    if (commandName === 'checkperm') {
        if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
        const targetUser = interaction.options.getUser('target') || interaction.user;
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            await interaction.reply({ content: 'Member not found.', ephemeral: true });
            return;
        }

        const evaluation = getMemberHighestTier(targetMember);
        const hierarchy = canModerateTarget(interaction.member, targetMember);
        
        let response = `🛡️ **Tier**: Level \`${evaluation.tier}\` (${evaluation.tierName})\n`;
        if (interaction.member.id !== targetMember.id) {
            response += hierarchy.allowed ? `✅ You outrank this user.` : `❌ You cannot moderate this user.`;
        }
        await interaction.reply({ content: response, ephemeral: true });
        return;
    }

    // --- WARN & KICK MODERATION LOGIC ---
    if (commandName === 'warn' || commandName === 'kick') {
        if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
        
        const targetUser = interaction.options.getUser('target', true);
        const reason = interaction.options.getString('reason', true);
        
        // Fetch the actual member object from the server
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            await interaction.reply({ content: '❌ That user is not in the server.', ephemeral: true });
            return;
        }

        // 1. SECURITY: Run our Phase 7 Hierarchy Check
        const hierarchy = canModerateTarget(interaction.member, targetMember);
        if (!hierarchy.allowed) {
            await interaction.reply({ 
                content: `❌ **Permission Denied**: ${hierarchy.reason}`, 
                ephemeral: true 
            });
            return;
        }

        // 2. EXECUTE THE COMMAND
        if (commandName === 'warn') {
            // Save to database
            await ModerationService.logInfraction(interaction.guild.id, targetMember.id, interaction.user.id, 'WARN', reason);
            
            // Attempt to DM the user to let them know they were warned
            await targetMember.send(`⚠️ You were **warned** in ${interaction.guild.name} for: \`${reason}\``).catch(() => null);
            
            await interaction.reply({ content: `✅ **${targetUser.tag}** has been formally warned.\nReason: \`${reason}\`` });
        }

        if (commandName === 'kick') {
            // Check if the bot itself has permission to kick this specific user
            if (!targetMember.kickable) {
                await interaction.reply({ content: `❌ My bot role is not high enough to kick **${targetUser.tag}**. Move my role higher in Server Settings.`, ephemeral: true });
                return;
            }

            // Save to database BEFORE kicking, so we don't lose the record if the kick fails
            await ModerationService.logInfraction(interaction.guild.id, targetMember.id, interaction.user.id, 'KICK', reason);
            
            // DM the user, then kick them
            await targetMember.send(`🔨 You were **kicked** from ${interaction.guild.name} for: \`${reason}\``).catch(() => null);
            await targetMember.kick(reason);
            
            await interaction.reply({ content: `✅ **${targetUser.tag}** has been kicked.\nReason: \`${reason}\`` });
        }
    }
});

client.login(env.DISCORD_TOKEN);