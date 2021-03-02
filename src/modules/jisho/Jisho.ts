import Discord, { DiscordAPIError, MessageEmbed, MessageReaction, ReactionEmoji } from 'discord.js';
import { Base } from '../../lib/discordUtil/Base';
import { Bot, Command } from '../../lib/discordUtil/Decorator';
import fetch from 'node-fetch';

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
    async Eigo(message: Discord.Message, ...args: string[]) {
        const word:string = (args.length>1) ? args.join(' ') : args[0];
        const req = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`);

        if(req.ok){
            const res:APIResponse = await req.json();
            if(res.data.length){
                let embed:JishoEmbed = new JishoEmbed(res);
                const msg = await message.channel.send(embed.Phrase());
                embed.handlePaging(msg);
                HandleDeleteReaction(message,msg,embed);
            }
            else{
                let embed:JishoEmbed|null = new JishoEmbed(res);
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

    constructor(response:APIResponse){
        this.response = response;
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
        const NextPageReaction = msg.createReactionCollector(nextPageFilter, {time: 200000 });
        const PreviousPageReaction = msg.createReactionCollector(PreviousPageFilter, {time: 200000 });
        
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

    }
    public async addReactions(msg:Discord.Message,index:number,pages:number){
        await msg.reactions.removeAll();
        msg.react("❌");

        if(index!==0){
            msg.react("⬅️");
        }
        if(pages!==1&&index+1<pages){
            msg.react("➡️");
        }
    }
}