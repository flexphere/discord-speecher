import * as path from 'path';
import Discord from 'discord.js';
import { Base } from './discordUtil/Base';
import { Bot, Listen, Command } from './discordUtil/Decorator';
import { Connection } from './DB';
const textToSpeech = require('@google-cloud/text-to-speech');

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

interface VoiceConfig {
    type: string
    rate: number
    pitch: number
    active: number
    [key:string]: any
}

@Bot()
export class Speecher extends Base {
    connection!: Discord.VoiceConnection;
    playing: boolean = false;
    queue: string[] = [];


    @Command('!s help')
    async Help(message: Discord.Message, ...args: string[]) {
        return this.flashMessage(message.channel, `**Usage**
\`\`\`
再起動
!s reboot

自身の音声設定を確認
!s me

自身の読み上げを有効化
!s activate

自身の読み上げを無効化
!s deactivate

自身の声のモデルを設定（val: 0〜3）
!s voice <val>

自身の声の高さを設定（val: 0〜10）
!s pitch <val>

自身の声の速度を設定（val: 0〜10）
!s speed <val>

GodFieldの効果音を鳴らす
!s gf <start|die|hit|damage|reflect|block|money|win|draw>
\`\`\`
        `, 20000);
    }

    @Command('!s gf')
    async GodField(message: Discord.Message, ...args: string[]) {
        if (message.author.bot) {
            return;
        }

        if ( ! message.member) {
            console.log('not member');
            return;
        }

        if ( ! GodFieldSounds.includes(args[0][0])) {
            console.log('no sound');
            return;
        }

        if ( ! (message.channel instanceof  Discord.TextChannel)) {
            console.log('not in textchannel');
            return;
        }

        if ( ! message.member.voice.channel) {
            console.log('not in voicechannel');
            return;
        }

        if (message.member.voice.channel.name !== message.channel.name) {
            console.log('voicechannel name not match textchannel name');
            return;
        }

        if ( ! this.connection || this.connection.channel.name !== message.member.voice.channel.name) {
            this.connection = await message.member.voice.channel.join();
        }

        if ( ! this.connection) {
            return;
        }

        const audiofile = path.resolve('./') + `/sounds/${args[0]}.mp3`;
        this.queue.push(audiofile);

        if ( ! this.playing) {
            this.Speak();
        }
    }

    @Command('!s me')
    async Me(message: Discord.Message, ...args: string[]) {
        if (message.author.bot) {
            return;
        }

        if ( ! message.member) {
            return;
        }

        const voice = await this.getOrCreateVoiceConfig(message.member.id);
        const pitch = voice.pitch + 5;
        const speed = voice.rate ? (voice.rate - 1) * 10  : 0;
        this.flashMessage(message.channel, `type:${voice.type}, speed:${speed}, pitch:${pitch}`);
    }

    @Command('!s activate')
    async Activate(message: Discord.Message, ...args: string[]) {
        if (message.author.bot) {
            return;
        }

        if ( ! message.member) {
            return;
        }

        const db = await Connection();
        await db.query('update voices set active = 1 where user_id = ?;', [message.member.id]);
        this.flashMessage(message.channel, "Done!");
    }

    @Command('!s deactivate')
    async Deactivate(message: Discord.Message, ...args: string[]) {
        if (message.author.bot) {
            return;
        }

        if ( ! message.member) {
            return;
        }

        const db = await Connection();
        await db.query('update voices set active = 0 where user_id = ?;', [message.member.id]);
        this.flashMessage(message.channel, "Done!");
    }

    @Command('!s reboot')
    async Reboot(message: Discord.Message, ...args: string[]) {
        process.exit(0);
    }

    @Command('!s leave')
    async Leave(message: Discord.Message, ...args: string[]) {
        if ( ! this.connection) {
            return;
        }

        this.connection.disconnect();
    }
    
    @Command('!s voice')
    async SetVoice(message: Discord.Message, ...args: string[]) {
        if (message.author.bot) {
            return;
        }

        if ( ! message.member) {
            return;
        }

        const voice = Number(args[0]);
        if (isNaN(voice) || voice < 0 || voice > 3) {
            this.flashMessage(message.channel, "0〜3の数字で指定してくれぃ");
            return;
        }

        const db = await Connection();
        await db.query('update voices set type = ? where user_id = ?;', [VoiceTypes[voice], message.member.id]);
        this.flashMessage(message.channel, "Done!");
    }

    @Command('!s pitch')
    async SetPitch(message: Discord.Message, ...args: string[]) {
        if (message.author.bot) {
            return;
        }

        if ( ! message.member) {
            return;
        }

        const pitch = Number(args[0]);
        if (isNaN(pitch) || pitch < 0 || pitch > 10) {
            this.flashMessage(message.channel, "0〜10の数字で指定してくれぃ");
            return;
        }

        const db = await Connection();
        await db.query('update voices set pitch = ? where user_id = ?;', [pitch - 5, message.member.id]);
        this.flashMessage(message.channel, "Done!");
    }

    @Command('!s speed')
    async SetSpeed(message: Discord.Message, ...args: string[]) {
        if (message.author.bot) {
            return;
        }

        if ( ! message.member) {
            return;
        }

        const speed = Number(args[0]);
        if (isNaN(speed) || speed < 0 || speed > 10) {
            this.flashMessage(message.channel, "0〜10の数字で指定してくれぃ");
            return;
        }

        const db = await Connection();
        await db.query('update voices set rate = ? where user_id = ?;', [speed ? speed / 10 + 1 : 0, message.member.id]);
        this.flashMessage(message.channel, "Done!");
    }

    @Listen('message')
    async Queue(message: Discord.Message, ...args: string[]) {
        try {
            if ( ! (message.channel instanceof  Discord.TextChannel)) {
                return;
            }

            if (message.author.bot) {
                return;
            }

            if ( ! message.member) {
                return;
            }

            if ( ! message.member.voice.channel) {
                return;
            }

            if (message.member.voice.channel.name !== message.channel.name) {
                return;
            }

            if ( ! message.member.voice.selfMute) {
                return;
            }

            if ( message.cleanContent.startsWith("!")) {
                return;
            }

            if ( ! this.connection || this.connection.channel.name !== message.member.voice.channel.name) {
                this.connection = await message.member.voice.channel.join();
            }

            if ( ! this.connection) {
                return;
            }

            const content = message.cleanContent;
            const client = new textToSpeech.TextToSpeechClient();
            const voice = await this.getOrCreateVoiceConfig(message.member.id);

            if (voice.active === 0 ) {
                return;
            }

            const request = {
                input: { text: this.filterContent(content) },
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
            active: 1,
        };
        
        const db = await Connection();
        await db.query('insert into voices (user_id, type, rate, pitch, active) values (?, ?, ?, ?, 0);', [id, voice.type, voice.rate, voice.pitch]);

        return voice;
    }

    filterContent(text) {
        text = text.replace(/[ｗ|w]+$/, "笑い");
        text = text.replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/, "URL");
        text = text.replace(/```[^`]+```/g, ''); // remove code blocks
        text = text.replace(/<([^\d]+)\d+>/g, "$1");
        return text;
    }

    async flashMessage(channel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel, context: string | Discord.MessageEmbed, duration: number = 5000) {
        const message = await channel.send(context);
        message.delete({timeout: duration});
        return message;
    }
}