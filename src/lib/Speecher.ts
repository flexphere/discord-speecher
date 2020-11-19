const textToSpeech = require('@google-cloud/text-to-speech');

import * as path from 'path';
import * as db from './DB';
import Discord, { DiscordAPIError, ClientVoiceManager } from 'discord.js';

import { logger } from './Logger';
import { Base } from './discordUtil/Base';
import { Bot, Listen, Command } from './discordUtil/Decorator';
import HelpText from './HelpText';

interface VoiceConfig {
    type: string
    rate: number
    pitch: number
    active: number
}
interface SpeechQueue {
    channel: Discord.VoiceChannel
    content: string
}

interface SpeechMessage {
    member: Discord.GuildMember
    textChannel: Discord.TextChannel
    voiceChannel: Discord.VoiceChannel
    content: string
}


type RequiredAndNotNull<T> = {
    [P in keyof T]-?: Exclude<T[P], null | undefined>
}

type RequireAndNotNullSome<T, K extends keyof T> = 
    RequiredAndNotNull<Pick<T, K>> & Omit<T, K>;

type Message = RequireAndNotNullSome<Discord.Message, 'member' | 'channel'>

const VoiceTypes = [
    'ja-JP-Standard-A',
    'ja-JP-Standard-B',
    'ja-JP-Standard-C',
    'ja-JP-Standard-D',
];

const GodFieldSounds = [
    'start',
    'die',
    'hit',
    'damage',
    'block',
    'win',
    'money',
    'draw',
    'reflect'
];

interface VoiceState {
    channel?: Discord.VoiceChannel
}

@Bot()
export class Speecher extends Base {
    playing: boolean = false;
    queue: SpeechQueue[] = [];

    @Command('!s help')
    async Help(message: Message) {
        return this.flashMessage(message.channel, HelpText, 20000);
    }

    @Command('!s gf')
    async GodField(message: Discord.Message, ...args: string[]) {
        const speechMessage = this.isSpeechMessage(message);
        if ( ! speechMessage) {
            return;
        }
        
        if ( ! GodFieldSounds.includes(args[0][0])) {
            logger.debug(`audio file not found ${args[0][0]}`)
            return;
        }

        const audiofile = path.resolve('./') + `/sounds/${args[0]}.mp3`;
        this.queue.push({
            channel: speechMessage.voiceChannel,
            content: audiofile
        });

        if ( ! this.playing) {
            this.Speak();
        }
    }

    @Command('!s me')
    async Me(message: Message) {
        const voice = await this.getOrCreateVoiceConfig(message.member.id);
        const pitch = voice.pitch + 5;
        const speed = voice.rate ? (voice.rate - 1) * 10  : 0; // TODO: to int 
        this.flashMessage(message.channel, `type:${voice.type}, speed:${speed.toFixed(2)}, pitch:${pitch.toFixed(2)}`);
    }

    @Command('!s activate')
    async Activate({member, channel}: Message, ...args: string[]) {
        await this.ActivateVoiceStatus(member.id);
        this.flashMessage(channel, "Done!");
    }

    @Command('!s deactivate')
    async Deactivate({member, channel}: Message, ...args: string[]) {
        await this.DeactivateVoiceStatus(member.id);
        this.flashMessage(channel, "Done!");
    }

    @Command('!s reboot')
    async Reboot() {
        process.exit(0);
    }

    @Command('!s leave')
    async Leave(message: Message) {
        const conn = this.client.voice?.connections.find(v => v.channel.id === message.member.voice.channel?.id)
        conn?.disconnect();
    }
    
    @Command('!s voice')
    async SetVoice({member, channel}: Message, ...args: string[]) {
        const voice = Number(args[0]);
        if (isNaN(voice) || voice < 0 || voice > 3) {
            this.flashMessage(channel, "0〜3の数字で指定してくれぃ");
            return;
        }

        this.UpdateVoiceType(VoiceTypes[voice], member.id);
        this.flashMessage(channel, "Done!");
    }

    @Command('!s pitch')
    async SetPitch({member, channel}: Message, ...args: string[]) {
        const pitch = Number(args[0]);
        if (isNaN(pitch) || pitch < 0 || pitch > 10) {
            this.flashMessage(channel, "0〜10の数字で指定してくれぃ");
            return;
        }

        await this.UpdateVoicePitch(pitch - 5, member.id);
        this.flashMessage(channel, "Done!");
    }

    @Command('!s speed')
    async SetSpeed({member, channel}: Message, ...args: string[]) {
        const speed = Number(args[0]);
        if (isNaN(speed) || speed < 0 || speed > 10) {
            this.flashMessage(channel, "0〜10の数字で指定してくれぃ");
            return;
        }

        await this.UpdateVoiceSpeed(speed ? speed / 10 + 1 : 0, member.id);
        this.flashMessage(channel, "Done!");
    }

    @Listen('message')
    async Queue(message: Discord.Message, ...args: string[]) {
        try {
            const speechMessage = this.isSpeechMessage(message);
            if ( ! speechMessage) {
                return;
            }

            const client = new textToSpeech.TextToSpeechClient();
            const voice = await this.getOrCreateVoiceConfig(speechMessage.member.id);

            if (voice.active === 0 ) {
                return;
            }

            const request = {
                input: { text: this.filterContent(speechMessage.content) },
                voice: {
                    languageCode: 'ja-JP',
                    name: voice.type
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: voice.rate,
                    pitch: voice.pitch
                },
            };
            const [response] = await client.synthesizeSpeech(request);
            const buffer = Buffer.from(response.audioContent.buffer);
            const dataurl = `data:‎audio/mpeg;base64,${buffer.toString('base64')}`;
            this.queue.push({
                channel: speechMessage.voiceChannel,
                content: dataurl
            });
            logger.debug(`Queue: ${speechMessage.voiceChannel.name} - ${speechMessage.content}`);

            if ( ! this.playing) {
                this.Speak();
            }
        } catch (e) {
            console.error(e);
            message.channel.send('｡ﾟ(ﾟ´Д｀ﾟ)ﾟ｡ごめん。エラーだわ');
        }
    }

    @Listen('voiceStateUpdate')
    async stateUpdate(...arg) {//beforeState:Discord.VoiceState, afterState:Discord.VoiceState
        console.log(arg);
        const beforeState = arg[0];
        const afterState = arg[1];
        // user left the channel
        if (beforeState.channelID && !afterState.channelID) {
            const memberCount = <number>beforeState.channel?.members?.size;
            if (memberCount < 2) {
                const conn = this.client.voice?.connections.find(v => v.channel.id === beforeState.channelID)
                conn?.disconnect();
            }
        }
    }

    async Speak() {
        const speech = this.queue.shift();
        if ( ! speech) {
            return;
        }

        const conn = await speech.channel.join();
        if ( ! conn) {
            return;
        }

        const dispatcher = conn.play(speech.content);
        this.playing = true;

        dispatcher.on('finish', () => {
            this.playing = false;
            this.Speak();
        });
    }

    async getOrCreateVoiceConfig(id: string): Promise<VoiceConfig> {
        const row = this.getVoiceConfig(id);
        if ( ! row) {
            return this.createVoiceConfig(id);
        }
        return row;
    }

    isSpeechMessage(message:Discord.Message): SpeechMessage | null {
        if (message.author.bot) {
            return null;
        }

        if ( ! message.member) {
            return null;
        }

        if ( ! (message.member instanceof Discord.GuildMember)) {
            return null;
        }

        if ( ! (message.member.voice.channel instanceof Discord.VoiceChannel)) {
            return null;
        }
        
        if ( ! (message.channel instanceof Discord.TextChannel)) {
            return null;
        }

        if (message.member.voice.channel.name !== message.channel.name) {
            return null;
        }

        if ( message.cleanContent.startsWith("!")) {
            return null;
        }

        return {
            member: message.member,
            textChannel: message.channel,
            voiceChannel: message.member.voice.channel,
            content: message.cleanContent
        }
    }

    filterContent(text:string): string {
        text = text.replace(/[ｗ|w]+$/, "笑い");
        text = text.replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/, "URL");
        text = text.replace(/```[^`]+```/g, ''); // remove code blocks
        text = text.replace(/<([^\d]+)\d+>/g, "$1");
        text = text.replace(/^>.*/mg, "");
        return text;
    }

    async flashMessage(channel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel, context: string | Discord.MessageEmbed, duration: number = 5000): Promise<Discord.Message> {
        const message = await channel.send(context);
        message.delete({timeout: duration});
        return message;
    }

    async getVoiceConfig(id: string): Promise<VoiceConfig> {
        return await db.query('select * from voices where user_id = ?', [id]) as VoiceConfig;
    }

    async createVoiceConfig(id: string): Promise<VoiceConfig> {
        const rand = (min, max) => Math.random() * (max - min) + min;

        const voice = {
            type: VoiceTypes[Math.floor(rand(0, 5))],
            rate: (rand(0.8, 2)).toFixed(2), // 0.25〜4  default 1  want 0.8〜2
            pitch: (rand(-5, 5)).toFixed(1), //-20.0 〜 20.0 default 0 want -5〜5
            active: 1,
        };
        
        await db.exec('insert into voices (user_id, type, rate, pitch, active) values (?, ?, ?, ?, 0);', [id, voice.type, voice.rate, voice.pitch]);

        return voice;
    }

    async UpdateVoicePitch(pitch, member_id) {
        logger.debug(`updating voice config: pitch=${pitch} member_id=${member_id}`);
        await db.exec('update voices set pitch = ? where user_id = ?;', [pitch, member_id]);
    }

    async UpdateVoiceSpeed(speed, member_id) {
        logger.debug(`updating voice config: speed=${speed} member_id=${member_id}`);
        await db.exec('update voices set rate = ? where user_id = ?;', [speed, member_id]);
    }

    async UpdateVoiceType(voice_type, member_id) {
        logger.debug(`updating voice config: type=${voice_type} member_id=${member_id}`);
        await db.exec('update voices set type = ? where user_id = ?;', [voice_type, member_id]);
    }
    
    async ActivateVoiceStatus(member_id) {
        logger.debug(`activating voice: member_id=${member_id}`);
        await db.exec('update voices set active = 1 where user_id = ?;', [member_id]);
    }
    
    async DeactivateVoiceStatus(member_id) {
        logger.debug(`deactivating voice: member_id=${member_id}`);
        await db.exec('update voices set active = 0 where user_id = ?;', [member_id]);
    }
}