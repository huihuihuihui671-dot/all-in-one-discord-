export const BotConfig = {
    // Colors for our Discord Embeds (Messages with colored sidebars)
    colors: {
        primary: 0x5865F2,   // Discord Blurple
        success: 0x57F287,   // Green
        error: 0xED4245,     // Red
        warning: 0xFEE75C,   // Yellow
        info: 0xEB459E       // Pink
    },
    
    // AI Models we will use with OpenRouter
    ai: {
        // A fast, smart model for general chatting and commands
        assistantModel: "meta-llama/llama-3-8b-instruct:free",
        // A strict model for checking toxicity and moderation
        moderationModel: "meta-llama/llama-3-8b-instruct:free"
    }
};