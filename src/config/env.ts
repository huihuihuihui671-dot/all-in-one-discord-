import { config } from 'dotenv';
import { z } from 'zod';

// Load the .env file
config();

// 1. Define the rules for our passwords (Environment Variables)
const envSchema = z.object({
    DISCORD_TOKEN: z.string().min(1, "Discord Token is required"),
    DISCORD_CLIENT_ID: z.string().min(1, "Client ID is required"),
    DISCORD_GUILD_ID: z.string().min(1, "Guild ID is required"),
    DATABASE_URL: z.string().url("Database URL must be a valid link"),
    // The AI key is optional right now, we won't crash if it's missing yet
    OPENROUTER_API_KEY: z.string().optional(), 
});

// 2. Check the passwords against our rules
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error("❌ CRITICAL ERROR: Invalid or missing environment variables!");
    console.error(parsedEnv.error.format());
    process.exit(1); // Stop the bot
}

// 3. Export the safe, validated passwords so the rest of the bot can use them
export const env = parsedEnv.data;