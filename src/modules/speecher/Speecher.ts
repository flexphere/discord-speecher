const textToSpeech = require('@google-cloud/text-to-speech');

import * as path from 'path';
import * as db from '../../lib/DB';
import Discord from 'discord.js';
import fetch from 'node-fetch';
import { logger } from '../../lib/Logger';
import { Base } from '../../lib/discordUtil/Base';
import { Bot, Listen, Command } from '../../lib/discordUtil/Decorator';
import { applyFilters, removeCodeBlock, removeQuote, removeURL, emojiToLabel } from "./Filters";
import { VoiceTypes, GodFieldSounds, FilterApis } from './Consts';
import HelpTextTemplate from './HelpText';

@Bot()
export class Speecher extends Base {
    playing: boolean = false;
    queue: SpeechQueue[] = [];

    @Command('!s help')
    async Help(message: Message) {
        const filterNames = FilterApis.map(f => f.name).join(' | ');
        const HelpText = HelpTextTemplate.replace('__FILTERS__', filterNames);
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

        const audiofile = path.resolve('./') + `/sounds/${args[0][0]}.mp3`;
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
        const pitch = <number>voice.pitch + 5;
        const speed = (<number>voice.rate - 1) * 10;
        this.flashMessage(message.channel, `type:${voice.type}, speed:${speed.toFixed()}, pitch:${pitch.toFixed()}, filter:${voice.filter}`);
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

    @Command('!s filter')
    async SetFilter({member, channel}: Message, ...args: string[]) {
        const filter = FilterApis.find(f => args[0] == f.name);
        if (! filter) {
            this.flashMessage(channel, "そんなフィルタなかった・・");
            return;
        }

        await this.UpdateVoiceFilter(filter, member.id);
        this.flashMessage(channel, "Done!");
    }

    @Listen('message')
    async Queue(message: Discord.Message, ...args: string[]) {
        try {
            const speechMessage = this.isSpeechMessage(message);
            if ( ! speechMessage) {
                return;
            }

            if (speechMessage.content.startsWith("!")) {
                return;
            }

            if ( ! speechMessage.member.voice.selfMute) {
                return;
            }

            const client = new textToSpeech.TextToSpeechClient();
            const voice = await this.getOrCreateVoiceConfig(speechMessage.member.id);

            if (voice.active === 0 ) {
                return;
            }

            const filtered = await this.filterContent(voice, speechMessage.content);
            console.log(filtered)

            const request = {
                input: { text: filtered.content },
                voice: {
                    languageCode: filtered.language ?? 'ja-JP',
                    name:  filtered.voice?.type ?? voice.type
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate:  filtered.voice?.speed ?? voice.rate,
                    pitch:  filtered.voice?.pitch ?? voice.pitch
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
            logger.fatal(e);
            message.channel.send('｡ﾟ(ﾟ´Д｀ﾟ)ﾟ｡ごめん。エラーだわ');
        }
    }

    @Listen('voiceStateUpdate')
    async stateUpdate(...arg) {
        const beforeState:Discord.VoiceState = arg[0];
        const afterState:Discord.VoiceState = arg[1];

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
        let voiceConfig = await this.getVoiceConfig(id);
        return voiceConfig ?? await this.createVoiceConfig(id);
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

        return {
            member: message.member,
            textChannel: message.channel,
            voiceChannel: message.member.voice.channel,
            content: message.cleanContent
        }
    }

    async filterContent(voice:VoiceConfig, text:string): Promise<FilterResponse> {
        const filteredText = applyFilters(text, [removeCodeBlock, removeQuote, removeURL, emojiToLabel]);

        const filter = FilterApis.find(f => f.name == voice.filter);
        if (filter && filter.name !== 'default') {
            const res = await fetch(filter.url, {
                method:'POST', 
                headers: { 'Content-Type': 'application/json' },
                body:JSON.stringify({
                    content: filteredText,
                    voice: {
                        type: voice.type,
                        pitch: voice.pitch,
                        speed: voice.rate
                    }
                })
            });
            return await res.json() as FilterResponse;
        }

        return { content: filteredText };
    }

    async flashMessage(channel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel, context: string | Discord.MessageEmbed, duration: number = 5000): Promise<Discord.Message> {
        const message = await channel.send(context);
        message.delete({timeout: duration});
        return message;
    }

    async getVoiceConfig(id: string): Promise<VoiceConfig | undefined> {
        return await db.query('select * from voices where user_id = ?', [id]) as VoiceConfig;
    }

    async createVoiceConfig(id: string): Promise<VoiceConfig> {
        const rand = (min, max) => Math.random() * (max - min) + min;

        const voice = {
            type: VoiceTypes[Math.floor(rand(0, 5))],
            rate: (rand(0.8, 2)).toFixed(2), // 0.25〜4  default 1  want 0.8〜2
            pitch: (rand(-5, 5)).toFixed(1), //-20.0 〜 20.0 default 0 want -5〜5
            active: 1,
            filter: 'default'
        };
        
        await db.exec('insert into voices (user_id, type, rate, pitch, active, filter) values (?, ?, ?, ?, ?, ?);', [id, voice.type, voice.rate, voice.pitch, voice.active, voice.filter]);

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

    async UpdateVoiceFilter(filter, member_id) {
        logger.debug(`updating voice config: type=${filter.name} member_id=${member_id}`);
        await db.exec('update voices set filter = ? where user_id = ?;', [filter.name, member_id]);
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