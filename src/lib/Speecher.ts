import Discord from 'discord.js';
import { Base } from './discordUtil/Base';
import { Bot, Command, Listen } from './discordUtil/Decorator';
const fs = require('fs');
const util = require('util');
const textToSpeech = require('@google-cloud/text-to-speech');

@Bot()
export class Speecher extends Base {
    userId: string = "";
    connection!: Discord.VoiceConnection;

    @Listen('message')
    async Speak(message: Discord.Message, ...args: string[]) {
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
            const request = {
                input: { text: content },
                voice: { languageCode: 'ja-JP', ssmlGender: 'NEUTRAL' },
                audioConfig: { audioEncoding: 'MP3' },
            };
            const [response] = await client.synthesizeSpeech(request);

            // const writeFile = util.promisify(fs.writeFile);
            // await writeFile('output.mp3', response.audioContent, 'binary');

            const buffer = Buffer.from(response.audioContent.buffer);
            const dataurl = `data:‎audio/mpeg;base64,${buffer.toString('base64')}`;
            this.connection.play(dataurl);
        } catch (e) {
            console.error(e);
            message.channel.send('｡ﾟ(ﾟ´Д｀ﾟ)ﾟ｡ごめん。エラーだわ');
        }
    }

    async flashMessage(channel: Discord.TextChannel | Discord.DMChannel, context: string | Discord.MessageEmbed, duration: number = 5000) {
        const message = await channel.send(context);
        message.delete({timeout: duration});
        return message;
    }
}