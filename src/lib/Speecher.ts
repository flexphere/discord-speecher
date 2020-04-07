import Discord from 'discord.js';
import { Base } from './discordUtil/Base';
import { Bot, Listen } from './discordUtil/Decorator';
import { Connection } from './DB';
const textToSpeech = require('@google-cloud/text-to-speech');

const VoiceTypes = [
    'ja-JP-Standard-A',
    'ja-JP-Standard-B',
    'ja-JP-Standard-C',
    'ja-JP-Standard-D',
];

interface VoiceConfig {
    type: string
    rate: number
    pitch: number
    [key:string]: any
}

@Bot()
export class Speecher extends Base {
    connection!: Discord.VoiceConnection;
    playing: boolean = false;
    queue: string[] = [];

    @Listen('message')
    async Queue(message: Discord.Message, ...args: string[]) {
        try {
            if (message.author.bot) {
                return;
            }

            if ( ! message.member) {
                return;
            }

            if ( ! message.member.voice.channel) {
                return;
            }

            if ( ! message.member.voice.selfMute) {
                return;
            }
    
            this.connection = await message.member.voice.channel.join();
            if ( ! this.connection) {
                return;
            }

            const content = message.cleanContent;
            const client = new textToSpeech.TextToSpeechClient();
            const voice = await this.getOrCreateVoiceConfig(message.member.id);
            const request = {
                input: { text: content },
                voice: {
                    languageCode: 'ja-JP',
                    name: voice.type
                    // ssmlGender: 'NEUTRAL',
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
            this.queue.push(dataurl);

            if ( ! this.playing) {
                this.Speak();
            }
        } catch (e) {
            console.error(e);
            message.channel.send('｡ﾟ(ﾟ´Д｀ﾟ)ﾟ｡ごめん。エラーだわ');
        }
    }

    @Listen('voiceStateUpdate')
    async stateUpdate(...args: any) {
        if ( ! this.connection) {
            return;
        }

        if ( this.connection.status !== 0 ) {
            return;
        }

        const memberCount = this.connection.channel.members.array().length;
        if (memberCount < 2) {
            this.connection.disconnect();
        }
    }

    async Speak() {
        if (this.queue.length) {
            const data = this.queue.shift();
            if ( ! data) return;
            const dispatcher = this.connection.play(data);
            this.playing = true;
            dispatcher.on('finish', () => {
                this.playing = false;
                this.Speak();
            });
        }
    }

    async getOrCreateVoiceConfig(id: string):Promise<VoiceConfig> {
        const db = await Connection();
        const rows = await db.query('select * from voices where user_id = ?', [id]);
        if ( ! rows.length) {
            return this.createVoiceConfig(id);
        }
        return rows[0];
    }

    async createVoiceConfig(id: string):Promise<VoiceConfig> {
        const rand = (min, max) => Math.random() * (max - min) + min;

        const voice = {
            type: VoiceTypes[Math.floor(rand(0, 5))],
            rate: (rand(0.8, 2)).toFixed(2), // 0.25〜4  default 1  want 0.8〜2
            pitch: (rand(-5, 5)).toFixed(1), //-20.0 〜 20.0 default 0 want -5〜5
        };
        
        const db = await Connection();
        await db.query('insert into voices (user_id, type, rate, pitch) values (?, ?, ?, ?);', [id, voice.type, voice.rate, voice.pitch]);

        return voice;
    }
}