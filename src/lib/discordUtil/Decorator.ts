import 'reflect-metadata';

const KEY = Symbol('discord-event');

export function Bot(){
    return function (target: Function) {
        const events : {[key:string]:string[]} = {};

        for (const propertyName of Object.keys(target.prototype)) {
            const descriptor = Object.getOwnPropertyDescriptor(target.prototype, propertyName);
            if (descriptor === undefined) {
                continue;
            }

            const isMethod = descriptor.value instanceof Function;
            if (!isMethod) {
                continue;
            }

            const ev = Reflect.getMetadata(KEY, target.prototype, propertyName);
            if (ev === undefined) {
                continue;
            }
            if (! events[ev]) {
                events[ev] = [];
            }
            events[ev].push(propertyName);
        }

        target.prototype._eventMap = events;
    }
}


export function Command(command: string) {
    const eventName = 'message';
    return function(target: any, propKey: string, descriptor: PropertyDescriptor) {
        Reflect.defineMetadata(KEY, eventName, target, propKey);
        const originalMethod = descriptor.value;
        descriptor.value = function(...args: any[]){
            if (args[0].author.bot) {
                return;
            }
            
            if ( ! args[0].content.startsWith(command)) {
                return;
            }

            const params = args[0].content.slice(command.length).trim().split(/ +/g);    
            return originalMethod.apply(this, [args[0], params]);
        };
    }    
}

export function Listen(eventName: string){
    return function(target: any, propKey: string, descriptor: PropertyDescriptor) {
        Reflect.defineMetadata(KEY, eventName, target, propKey);
        const originalMethod = descriptor.value;
        descriptor.value = function(...args: any[]){
            return originalMethod.apply(this, args);
        };
    }
}