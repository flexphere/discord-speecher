import Discord, { DiscordAPIError, MessageEmbed, MessageReaction, ReactionEmoji } from 'discord.js';
import textToSpeech from "@google-cloud/text-to-speech";
import { Base } from '../../lib/discordUtil/Base';
import { Bot, Command } from '../../lib/discordUtil/Decorator';
import fetch from 'node-fetch';
import { speak } from '../speecher/mixer';
import { logger } from "../../lib/Logger";

@Bot()
export class TextTranslator extends Base {
    @Command('!translate')
    async HelpEN(message: Discord.Message) {
        TranslateHelp(message);
    }
    @Command('!翻訳')
    async HelpJP(message: Discord.Message) {
        TranslateHelp(message);
    }

    @Command('!t')
    async Translate(message: Discord.Message, args:string[]) {
        const isMessageID = args.length==1 && Number(args[0])>0;
        const msgrefContent = (isMessageID) ? (await message.channel.messages.fetch(args[0])).content : message.content.slice(3)
        const jp = msgrefContent.match(/([一-龯ぁ-んァ-ン])/g);
        if(jp){
            //Ratio of Japanese characters in the string to determine
            //translation direction (EN=>JA || JA=>EN)
            const ratio = jp?.length/msgrefContent.length;
            if(ratio>=0.5){
                AttemptTranslate('ja', msgrefContent, message)
            }
            else{
                AttemptTranslate('en', msgrefContent, message)
            }
        }
        else{
            AttemptTranslate('en' ,msgrefContent, message)
        }
        
    }

}

async function TranslateHelp(message:Discord.Message){
    const embed = new Discord.MessageEmbed()
        .setColor('#4ab7ff')
        .setTitle('​Help')
        .addField('​使用方法 / How to Use','`React with/リアクションの絵文字 :flag_jp: | :flag_gb:`',true)
        message.channel.send(embed); //TO DO
}

async function AttemptTranslate(from:"en"|"ja",text:string,msg:Discord.Message){
    const {cookie,token} = await getMiraiTokens();
    if(!token || !cookie){
        logger.error(`[TRANSLATOR] - Token:${token} or Cookie ${cookie} is missing....or both?`)
        const embed = new Discord.MessageEmbed()
        .setColor('#ff2448')
        .setTitle('Error | エラー')
        .setDescription('Cannot get tokens...')
        msg.channel.send(embed); //TO DO
        return
    }
    else{
        const translation = await Translate(from,text,cookie,token);
        if(translation.error_msg){
            logger.error(`[TRANSLATOR] - Translation failed - ${translation.error_msg}`)
        }
        else{
            msg.delete();
            const prefix = (from=='en') ? 'が言った' : 'said'
            msg.channel.send(`${msg.author.toString()} ${prefix}: \r\n${translation.outputs[0].output[0].translation}`)
        }
    }
}

async function getMiraiTokens(){
    const req = await fetch('https://miraitranslate.com/trial/#');
    const res = await req.text();
    const regex = /var tran = "(?<variable>.*?)"/gm;
    const token = regex.exec(res)?.groups?.variable
    const cookie = getCookie(req.headers.get('set-cookie'));
    return {cookie:cookie,token:token};
}
async function Translate(from:"en"|"ja",text:string,cookie:string,token:string){
    console.log(`Fetching translation with token`,token,'and cookie',cookie)
    const req = await fetch('https://trial.miraitranslate.com/trial/api/translate.php',{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'Cookie':`translate_session=${cookie}`
        },
        body:JSON.stringify({
            InmtTarget:'',
            InmtTranslateType:'',
            adaptPhrases:[],
            filter_profile:'nmt',
            input:text,
            profile:'inmt',
            source:from,
            target: from=='en' ? 'ja' : 'en',
            tran:token,
            usePrefix:false,
            zt:false
        }),
    });
    const res = await req.json();
    return res as ITranResponse;

}

function getCookie(cookiesString:string|null){
    if(!cookiesString) return null
    const rawCookies = cookiesString.split(';');
    const cookies:Record<string,string> = {};
    rawCookies.map(c=>{
        let [key,v] = c.split('=');
        cookies[key] = v;
    });
    return cookies.translate_session
}
interface ITranResponse{
    status:"success"|"failed",
    error_msg?:string,
    outputs:{
        output:{
            translation:string
        }[]
    }[]
}