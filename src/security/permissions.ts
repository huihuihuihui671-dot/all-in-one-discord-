import { GuildMember, PermissionFlagsBits } from 'discord.js';

// 1. Numeric authority levels (Higher number = Higher authority)
export enum PermissionTier {
    USER = 0,
    NEW_MEMBER = 5,
    MEMBER = 10,
    VERIFIED = 15,
    PARTNER = 20,
    CREATOR = 25,
    STREAMER = 30,
    PLAYER = 35,
    COACH = 40,
    TRIAL_MOD = 50,
    MODERATOR = 60,
    HEAD_MOD = 70,
    TEAM_MANAGER = 75,
    ESPORTS_MANAGER = 80,
    ADMIN = 85,
    HEAD_ADMIN = 90,
    MANAGEMENT = 95,
    CO_OWNER = 98,
    OWNER = 100
}

// 2. Mapping common role names to their corresponding permission tier
export const RoleHierarchyMapping: Record<string, PermissionTier> = {
    'owner': PermissionTier.OWNER,
    'co-owner': PermissionTier.CO_OWNER,
    'management': PermissionTier.MANAGEMENT,
    'head admin': PermissionTier.HEAD_ADMIN,
    'admin': PermissionTier.ADMIN,
    'esports manager': PermissionTier.ESPORTS_MANAGER,
    'team manager': PermissionTier.TEAM_MANAGER,
    'head moderator': PermissionTier.HEAD_MOD,
    'moderator': PermissionTier.MODERATOR,
    'trial moderator': PermissionTier.TRIAL_MOD,
    'coach': PermissionTier.COACH,
    'player': PermissionTier.PLAYER,
    'streamer': PermissionTier.STREAMER,
    'creator': PermissionTier.CREATOR,
    'partner': PermissionTier.PARTNER,
    'verified': PermissionTier.VERIFIED,
    'member': PermissionTier.MEMBER,
    'new member': PermissionTier.NEW_MEMBER
};

// 3. Calculates the highest tier a specific user holds
export function getMemberHighestTier(member: GuildMember): { tier: PermissionTier; tierName: string } {
    // The server owner is always the absolute highest authority
    if (member.guild.ownerId === member.id) {
        return { tier: PermissionTier.OWNER, tierName: 'Owner' };
    }

    let highestTier = PermissionTier.USER;
    let highestTierName = 'User';

    // Scan every role the member currently has
    for (const role of member.roles.cache.values()) {
        const normalizedRoleName = role.name.toLowerCase().trim();
        const matchedTier = RoleHierarchyMapping[normalizedRoleName];

        if (matchedTier && matchedTier > highestTier) {
            highestTier = matchedTier;
            highestTierName = role.name;
        }
    }

    // Fallback: If they have Administrator permission in Discord, grant at least ADMIN tier
    if (highestTier < PermissionTier.ADMIN && member.permissions.has(PermissionFlagsBits.Administrator)) {
        return { tier: PermissionTier.ADMIN, tierName: 'Administrator (Inferred)' };
    }

    return { tier: highestTier, tierName: highestTierName };
}

// 4. Determines whether one user is allowed to moderate another user
export function canModerateTarget(
    actor: GuildMember,
    target: GuildMember
): { allowed: boolean; reason?: string } {
    if (actor.id === target.id) {
        return { allowed: false, reason: 'You cannot perform moderation actions on yourself.' };
    }

    if (target.id === actor.guild.ownerId) {
        return { allowed: false, reason: 'You cannot take action against the server owner.' };
    }

    // Discord built-in role ladder check (cannot act on someone with a higher/equal top role)
    if (target.roles.highest.position >= actor.roles.highest.position && actor.guild.ownerId !== actor.id) {
        return {
            allowed: false,
            reason: 'The target member holds a Discord role equal to or higher than your highest role.'
        };
    }

    // Organization staff hierarchy check
    const actorTier = getMemberHighestTier(actor);
    const targetTier = getMemberHighestTier(target);

    if (actorTier.tier <= targetTier.tier && actor.guild.ownerId !== actor.id) {
        return {
            allowed: false,
            reason: `Your organization rank (${actorTier.tierName}) is not higher than the target rank (${targetTier.tierName}).`
        };
    }

    return { allowed: true };
}