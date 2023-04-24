import Discord, { MessageReaction } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";
import textToSpeech from "@google-cloud/text-to-speech";
import { Base } from "../../lib/discordUtil/Base";
import { Bot, Command } from "../../lib/discordUtil/Decorator";
import fetch from "node-fetch";
import { logger } from "../../lib/Logger";
import { speak } from "../speecher/mixer";

@Bot()
export class TextTranslator extends Base {
  @Command("!translate")
  async HelpEN(message: Discord.Message) {
    TranslateHelp(message);
  }
  @Command("!翻訳")
  async HelpJP(message: Discord.Message) {
    TranslateHelp(message);
  }

  @Command("!t")
  async Translate(message: Discord.Message, args: string[]) {
    /**
     * - Checks if the content to translate is from a different message.
     * - Some MessageIDs have a <number-number> structure rather than just <number>
     * - This needs to be investigated. Is the <number-number> always > 0?
     */
    const isMessageID = args.length == 1 && Number(args[0]) > 0;
    /**
     * The content to translate.
     */
    let content = "";
    /**
     * - Only used if isMessageID is true. Refers to the message with ID.
     * - Necessary to refer to the original author.
     */
    let msgRef: Discord.Message | undefined;

    if (isMessageID) {
      msgRef = await message.channel.messages.fetch(args[0]);
      content = msgRef.content;
    } else {
      content = message.content.slice(3);
    }

    const jp = content.match(/([一-龯ぁ-んァ-ン])/g);
    let translateFrom: "en" | "ja" = "en";
    if (jp) {
      //Ratio of Japanese characters in the string to determine
      //translation direction (EN=>JA || JA=>EN)
      const ratio = jp?.length / content.length;
      if (ratio >= 0.5) {
        translateFrom = "ja";
      }
    }
    AttemptTranslate(translateFrom, content, message, msgRef, content);
  }
}

async function TranslateHelp(message: Discord.Message) {
  const embed = new Discord.EmbedBuilder()
    .setColor("#4ab7ff")
    .setTitle("​Help")
    .addFields({
      name: "​使用方法 / How to Use",
      value: "`React with/リアクションの絵文字 :flag_jp: | :flag_gb:`",
      inline: true,
    });
  message.channel.send({ embeds: [embed] }); //TO DO
}

async function AttemptTranslate(
  from: "en" | "ja",
  text: string,
  msg: Discord.Message,
  msgRef: Discord.Message | undefined,
  original: string
) {
  const { cookie, token } = await getMiraiTokens();
  if (!token || !cookie) {
    logger.error(
      `[TRANSLATOR] - Token:${token} or Cookie ${cookie} is missing....or both?`
    );
    const embed = new Discord.EmbedBuilder()
      .setColor("#ff2448")
      .setTitle("Error | エラー")
      .setDescription("Cannot get tokens...");
    msg.channel.send({ embeds: [embed] }); //TO DO
    return;
  } else {
    const translation = await Translate(from, text, cookie, token);
    if (translation.error_msg) {
      logger.error(
        `[TRANSLATOR] - Translation failed - ${translation.error_msg}`
      );
    } else {
      /**
       * The person calling the !t command
       */
      const caller = msg.member;
      /**
       * - The author of the message.
       * - If the caller refers to another message. The author of _that_ message.
       */
      const author = msgRef ? msgRef.author : msg.author;
      //Delete the caller message
      msg.delete();
      const prefix = from == "en" ? "が言った" : "said";
      const translationMsg = await msg.channel.send(
        `${original}\r\n\r\n${author.toString()} ${prefix}: \r\n${
          translation.outputs[0].output[0].translation
        }`
      );
      translationMsg.react("📣");
      handleReaction(
        from,
        translationMsg,
        translation.outputs[0].output[0].translation,
        caller as Discord.GuildMember
      );
    }
  }
}

async function getMiraiTokens() {
  const req = await fetch("https://miraitranslate.com/trial/#");
  const res = await req.text();
  const regex = /var tran = "(?<variable>.*?)"/gm;
  const token = regex.exec(res)?.groups?.variable;
  const cookie = getCookie(req.headers.get("set-cookie"));
  return { cookie: cookie, token: token };
}
async function Translate(
  from: "en" | "ja",
  text: string,
  cookie: string,
  token: string
) {
  const req = await fetch(
    "https://trial.miraitranslate.com/trial/api/translate.php",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `translate_session=${cookie}`,
      },
      body: JSON.stringify({
        InmtTarget: "",
        InmtTranslateType: "",
        adaptPhrases: [],
        filter_profile: "nmt",
        input: text,
        profile: "inmt",
        source: from,
        target: from == "en" ? "ja" : "en",
        tran: token,
        usePrefix: false,
        zt: false,
      }),
    }
  );
  const res = await req.json();
  return res as ITranResponse;
}
function getCookie(cookiesString: string | null) {
  if (!cookiesString) return null;
  const rawCookies = cookiesString.split(";");
  const cookies: Record<string, string> = {};
  for (const rawCookie of rawCookies) {
    let [key, v] = rawCookie.split("=");
    cookies[key] = v;
  }
  return cookies.translate_session;
}

function handleReaction(
  from: "en" | "ja",
  MSGTranslation: Discord.Message,
  translation: string,
  author: Discord.GuildMember
) {
  const SpeechFilter = (reaction: MessageReaction, user: Discord.User) => {
    return reaction.emoji.name == "📣" && !user.bot;
  };
  const SpeechReaction = MSGTranslation.createReactionCollector({
    filter: SpeechFilter,
    time: 200000,
  });
  SpeechReaction.on("collect", async (collected) => {
    Pronounce(from == "en" ? "ja" : "en", translation, author);
  });
}

async function Pronounce(
  lang: "en" | "ja",
  content: string,
  author: Discord.GuildMember
) {
  const request = {
    input: { text: content },
    voice: {
      languageCode: lang == "en" ? "en-US" : "ja-JP",
      name: lang == "en" ? "en-US-Wavenet-G" : "ja-JP-Wavenet-D",
    },
    audioConfig: {
      audioEncoding: "OGG_OPUS" as any,
      speakingRate: 0.85,
      pitch: 0,
    },
  };

  const client = new textToSpeech.TextToSpeechClient();
  const [response] = await client.synthesizeSpeech(request);

  const voiceChannel = author.voice.channel;
  if (voiceChannel instanceof Discord.VoiceChannel) {
    const voiceConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    speak(voiceConnection, response.audioContent as Uint8Array);
  }
}
interface ITranResponse {
  status: "success" | "failed";
  error_msg?: string;
  outputs: {
    output: {
      translation: string;
    }[];
  }[];
}
