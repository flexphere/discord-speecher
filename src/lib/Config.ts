import {Intents} from 'discord.js';
export const Config = {
    token: process.env.DISCORD_TOKEN || '',
    db: process.env.DB_FILE || '',
    intents:[Intents.FLAGS.GUILDS,Intents.FLAGS.GUILD_MEMBERS,Intents.FLAGS.GUILD_MESSAGES,Intents.FLAGS.GUILD_MESSAGE_REACTIONS,Intents.FLAGS.GUILD_VOICE_STATES]
}