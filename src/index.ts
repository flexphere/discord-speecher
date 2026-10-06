import { Client, GatewayIntentBits } from "discord.js";
import { Config } from "./lib/Config.js";
import { Control } from "./lib/discordUtil/Control.js";
import { Speecher } from "./modules/speecher/Speecher.js";
import { Jisho } from "./modules/jisho/Jisho.js";
import { TextTranslator } from "./modules/translator/Translator.js";

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildVoiceStates,
];
const client = new Client({ intents });
const controller = new Control(client, Config.token);
controller.use(Speecher);
controller.use(Jisho);
controller.use(TextTranslator);
controller.start();
