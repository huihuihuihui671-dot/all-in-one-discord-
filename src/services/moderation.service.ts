import prisma from '../database';
import { Logger } from './logger.service';

export const ModerationService = {
    /**
     * Saves a permanent record of a moderation action to the database.
     */
    async logInfraction(
        guildId: string, 
        userId: string, 
        moderatorId: string, 
        type: 'WARN' | 'KICK' | 'BAN' | 'TIMEOUT', 
        reason: string
    ) {
        try {
            const infraction = await prisma.infraction.create({
                data: {
                    guildId,
                    userId,
                    moderatorId,
                    type,
                    reason
                }
            });
            
            Logger.moderation(`[${type}] User${userId} was actioned by ${moderatorId}. Reason: ${reason}`);
            return infraction;
        } catch (error) {
            Logger.error(`Failed to save ${type} infraction to database:`, error);
            return null;
        }
    }
};