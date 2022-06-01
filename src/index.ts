import Discord from 'discord.js';
import { Config } from './lib/Config'
import { Control } from './lib/discordUtil/Control';
import { Speecher } from './modules/speecher/Speecher';
import { Jisho } from './modules/jisho/Jisho';
import { TextTranslator } from './modules/translator/Translator';

const client = new Discord.Client({intents:Config.intents});
const controller = new Control(client, Config.token);
controller.use(Speecher);
controller.use(Jisho);
controller.use(TextTranslator);
controller.start();