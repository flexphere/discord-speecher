import Discord from "discord.js";

type Class = {
  new (...args: any[]): any;
  [prop: string]: any;
};

interface DiscordControlEvent {
  klass: Class;
  func: string[];
}

interface DiscordControlEvents {
  [key: string]: DiscordControlEvent[];
}

export class Control {
  mods: Class[] = [];
  events: DiscordControlEvents = {};

  constructor(public client: Discord.Client, public token: string) {}

  use(mod: Class) {
    this.mods.push(mod);
  }

  start() {
    this.mods.forEach((mod) => {
      const Mod = new mod(this.client);
      for (let event of Object.keys(mod.prototype._eventMap)) {
        if (!this.events[event]) {
          this.events[event] = [];
        }
        this.events[event].push({
          klass: Mod,
          func: mod.prototype._eventMap[event],
        });
      }
    });

    for (let event of Object.keys(this.events)) {
      const ev = <any>event;
      this.client.on(ev, (...args: any[]) => {
        this.events[event].map((v) => {
          v.func.map((f) => v.klass[f](...args));
        });
      });
    }

    this.client.login(this.token);
  }
}
