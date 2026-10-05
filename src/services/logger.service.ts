import winston from 'winston';
import fs from 'fs';
import path from 'path';

// 1. Create a "logs" folder automatically if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// 2. Setup the Winston logger
const winstonLogger = winston.createLogger({
    level: 'info',
    // Save to files as structured, machine-readable JSON
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        // 3. Print colorful, human-readable logs to the Terminal
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(
                    (info) => `[${info.timestamp}] ${info.level}:${info.message}`
                )
            )
        }),
        // 4. Save serious errors to their own dedicated file
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error' 
        }),
        // 5. Save everything to a giant combined history file
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log') 
        })
    ]
});

// 6. Export a simple Logger object that the rest of our bot will use
export const Logger = {
    // Standard Logs
    info: (msg: string) => winstonLogger.info(msg),
    warn: (msg: string) => winstonLogger.warn(msg),
    error: (msg: string, err?: any) => winstonLogger.error(`${msg}${err ? err : ''}`),
    
    // Specific custom log categories for our Esports Bot
    moderation: (msg: string) => winstonLogger.info(`[MODERATION] ${msg}`),
    security: (msg: string) => winstonLogger.warn(`[SECURITY] ${msg}`),
    esports: (msg: string) => winstonLogger.info(`[ESPORTS] ${msg}`),
    economy: (msg: string) => winstonLogger.info(`[ECONOMY] ${msg}`),
    tickets: (msg: string) => winstonLogger.info(`[TICKETS] ${msg}`),
    ai: (msg: string) => winstonLogger.info(`[AI] ${msg}`)
};