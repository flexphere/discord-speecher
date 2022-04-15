import Discord, { DiscordAPIError, MessageEmbed, MessageReaction, ReactionEmoji } from 'discord.js';
import textToSpeech from "@google-cloud/text-to-speech";
import { Base } from '../../lib/discordUtil/Base';
import { Bot, Command } from '../../lib/discordUtil/Decorator';
import fetch from 'node-fetch';
import { speak } from '../speecher/mixer';

interface Japanese{
    word:string,
    reading:string
}
interface Senses{
    english_definitions:Array<string>,
    parts_of_speech:Array<string>,
}
interface Phrase{
    slug:string,
    is_common:boolean,
    tags:Array<string>,
    jlpt:Array<string>,
    japanese:Array<Japanese>,
    senses:Array<Senses>,
    attribution:{
        jmdict:boolean,
        jmnedict:boolean,
        dbpedia:boolean
    }

}
interface APIResponse{
    meta:{
        status:number
    },
    data:Array<Phrase>
}

@Bot()
export class Jisho extends Base {
    @Command('!j help')
    async Help(message: Discord.Message) {
        const embed = new Discord.MessageEmbed()
        .setColor('#4ab7ff')
        .setTitle('​Help')
        .addField('コマンド / Command','jisho',true)
        .addField('​使用方法 / How to Use','`!j jisho [言葉]`',true)
        .addField('​備考', `​これは翻訳システムではありません。​辞書です。​\r\n文を翻訳しないでください。`,false)
        .addField('Notes',`This is not a translation system. It's a dictionnary.\r\nDon't try to translate sentences.`,false);
        message.channel.send(embed); //TO DO
    }

    @Command('!j jisho')
    async LongJishoCommand(message: Discord.Message, ...args: string[]) {
        const word:string = (args.length>1) ? args.join(' ') : args[0];
        JishoCommand(message,word)
    }
    @Command('!jisho')
    async ShortJishoCommand(message: Discord.Message, ...args: string[]) {
        const word:string = (args.length>1) ? args.join(' ') : args[0];
        JishoCommand(message,word)
    }
}
async function JishoCommand(message: Discord.Message, word:string){
    
    const req = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`);

    if(req.ok){
        const res = await <Promise<APIResponse>>req.json();
        if(res.data.length){
            let embed:JishoEmbed = new JishoEmbed(res,message);
            const msg = await message.channel.send(embed.Phrase());
            embed.handlePaging(msg);
            HandleDeleteReaction(message,msg,embed);
        }
        else{
            let embed:JishoEmbed|null = new JishoEmbed(res,message);
            const msg = await message.channel.send(embed.Empty());
            setTimeout(()=>{
                embed = null;
                msg.delete();
            },3000)
        }
        
    }
    else{
        message.channel.send("Jisho error");
    }
}
async function HandleDeleteReaction(OriginalMessage:Discord.Message,BotReply:Discord.Message,Embed:JishoEmbed|null){
    const DeleteEmbedFilter = (reaction:MessageReaction,user:Discord.User) => {
        return reaction.emoji.name=="❌" && !user.bot;
    };
    const DeletePageReaction = BotReply.createReactionCollector(DeleteEmbedFilter, {time: 200000 });
    DeletePageReaction.on('collect',async collected=>{
        await BotReply.delete(); //Bot Embed
        await OriginalMessage.delete(); //User Command
        Embed = null; //Free RAM
    });
}

class JishoEmbed{

    private response:APIResponse;
    private index:number = 0;
    private message:Discord.Message;

    constructor(response:APIResponse,message:Discord.Message){
        this.response = response;
        this.message=message;
    }

    public page = {
        next:()=>{this.index = this.index+1},
        previous:()=>{this.index= this.index-1}
    };
    
    public Phrase():Discord.MessageEmbed{
        const phraseObj:Phrase = this.response.data[this.index];
        const embed = new Discord.MessageEmbed()
        .setColor('#2dc479')
        .setTitle(phraseObj.japanese[0].word ?? phraseObj.senses[0].english_definitions.join(', '))
        .setDescription(`**${phraseObj.senses[0].parts_of_speech.join(', ')}**\r\n${phraseObj.senses[0].english_definitions.join(', ')}`)
        .addField('Reading',phraseObj.japanese[0].reading)
        .addField('Page',`${this.index+1}/${this.response.data.length}`)
        return embed;
    };
    public Empty():Discord.MessageEmbed{
        const embed = new Discord.MessageEmbed()
        .setColor('#ba3b32')
        .setTitle('​結果なし / No Results')
        .setDescription(`**​​検索結果はありませんでした。/ No results found.**`)
        return embed;
    };

    public handlePaging(msg:Discord.Message){
        this.addReactions(msg,this.index,this.response.data.length);
        const nextPageFilter = (reaction:MessageReaction,user:Discord.User) => {
            return reaction.emoji.name=="➡️" && !user.bot;
        };
        const PreviousPageFilter = (reaction:MessageReaction,user:Discord.User) => {
            return reaction.emoji.name=="⬅️" && !user.bot;
        };
        const SpeechJPFilter = (reaction:MessageReaction,user:Discord.User) => {
            return reaction.emoji.name=="🇯🇵" && !user.bot;
        };
        const SpeechENFilter = (reaction:MessageReaction,user:Discord.User) => {
            return reaction.emoji.name=="🇬🇧" && !user.bot;
        };
        const NextPageReaction = msg.createReactionCollector(nextPageFilter, {time: 200000 });
        const PreviousPageReaction = msg.createReactionCollector(PreviousPageFilter, {time: 200000 });
        const JPReaction = msg.createReactionCollector(SpeechJPFilter, { time:200000 });
        const ENReaction = msg.createReactionCollector(SpeechENFilter, { time:200000 });
        NextPageReaction.on('collect',async collected=>{
            this.page.next();
            await msg.edit(this.Phrase());
            this.addReactions(msg,this.index,this.response.data.length);
        });
        PreviousPageReaction.on('collect',async collected=>{
            this.page.previous();
            await msg.edit(this.Phrase());
            this.addReactions(msg,this.index,this.response.data.length);
        });
        JPReaction.on('collect',async collected=>{
            await this.Pronounce('ja',this.response.data[this.index].japanese[0].word,msg)
        });
        ENReaction.on('collect',async collected=>{
            await this.Pronounce('en',this.response.data[this.index].senses[0].english_definitions[0],msg)
        });

    }
    public async addReactions(msg:Discord.Message,index:number,pages:number){
        await msg.reactions.removeAll();
        msg.react('🇬🇧');
        msg.react('🇯🇵');
        msg.react("❌");

        if(index!==0){
            msg.react("⬅️");
        }
        if(pages!==1&&index+1<pages){
            msg.react("➡️");
        }
        
    }

    public async Pronounce(lang:"en"|"ja",content:string,msg:Discord.Message){
        const request = {
            input: { text: content },
            voice: {
              languageCode: lang=="en" ? 'en-US' : "ja-JP",
              name: lang=="en" ? 'en-US-Wavenet-G' : 'ja-JP-Wavenet-D',
            },
            audioConfig: {
              audioEncoding: "OGG_OPUS" as any,
              speakingRate: 0.85,
              pitch: 0,
            },
          };
          
          const client = new textToSpeech.TextToSpeechClient();
          const [response] = await client.synthesizeSpeech(request);
    
          const voiceChannel = msg.member?.voice.channel;
          if(voiceChannel instanceof Discord.VoiceChannel){
            const voiceConnection = await voiceChannel.join();
            speak(voiceConnection, response.audioContent as Uint8Array);
          }
          
    }
}