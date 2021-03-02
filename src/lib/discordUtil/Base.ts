import Discord from 'discord.js';

export class Base {
    _eventMap!: {[key:string]:string[]};
    constructor(public client: Discord.Client){}
}