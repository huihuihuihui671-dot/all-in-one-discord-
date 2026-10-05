import { Message } from 'discord.js';
import { Logger } from '../services/logger.service';
import { getMemberHighestTier, PermissionTier } from './permissions';
import { ModerationService } from '../services/moderation.service';

// This is our temporary memory. It stores a user's ID, and a list of times they sent a message.
const messageCache = new Map<string, number[]>();

// --- ANTI-SPAM SETTINGS ---
const SPAM_LIMIT = 5; // Maximum messages allowed...
const TIME_WINDOW = 5000; // ...within this many milliseconds (5 seconds)
const TIMEOUT_DURATION = 5 * 60 * 1000; // Mute duration in milliseconds (5 minutes)

export const AntiSpam = {
    async analyze(message: Message) {
        // Ignore messages from other bots, or messages outside of a server
        if (message.author.bot || !message.guild || !message.member) return;

        // SECURITY: Do not scan or punish our own staff members
        const { tier } = getMemberHighestTier(message.member);
        if (tier >= PermissionTier.TRIAL_MOD) return;

        const now = Date.now();
        // Get the user's message history from our temporary memory (or create an empty list)
        const userMsgHistory = messageCache.get(message.author.id) || [];

        // Throw away any timestamps that are older than 5 seconds
        const recentMessages = userMsgHistory.filter(time => now - time < TIME_WINDOW);
        
        // Add the current message timestamp
        recentMessages.push(now);

        // Save the updated list back to memory
        messageCache.set(message.author.id, recentMessages);

        // CHECK: Did they cross the limit?
        if (recentMessages.length >= SPAM_LIMIT) {
            // SPAM DETECTED! 
            // First, clear their memory so the bot doesn't punish them 10 times in a row
            messageCache.delete(message.author.id); 
            
            try {
                Logger.security(`Spam detected from ${message.author.tag}. Executing automated lockdown.`);

                // 1. Delete the message that crossed the line
                await message.delete().catch(() => null);
                
                // 2. Mute (Timeout) the user in Discord
                await message.member.timeout(TIMEOUT_DURATION, 'Automated Anti-Spam: Sending messages too quickly');
                
                // 3. Save the official record to our Database (The bot itself is the "Moderator" here)
                await ModerationService.logInfraction(
                    message.guild.id,
                    message.author.id,
                    message.client.user.id, 
                    'TIMEOUT',
                    'Automated Anti-Spam: Sent too many messages too quickly.'
                );

                // 4. Announce it in the channel so others know the bot is protecting them
                await message.channel.send(`🛡️ **Automated Security**: ${message.author} has been muted for 5 minutes for spamming.`);
            } catch (error) {
                Logger.error('Failed to execute anti-spam action', error);
            }
        }
    }
};