import Discord from 'discord.js';
import { Config } from './lib/Config'
import { Control } from './lib/discordUtil/Control';
import { Speecher } from './modules/speecher/Speecher';
import { Jisho } from './modules/jisho/Jisho';

const client = new Discord.Client();
const controller = new Control(client, Config.token);
controller.use(Speecher);
controller.use(Jisho);
controller.start();