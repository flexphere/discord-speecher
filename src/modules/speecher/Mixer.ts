import prism from "prism-media";
import { Readable } from "stream";
import { MixerBase, Port } from "./MixerBase";

export class Mixer extends MixerBase<Buffer, [Port<Buffer>, Port<Buffer>]> {
  constructor() {
    super(20, mix, queuedPort<Buffer>(), takeoverablePort<Buffer>());
  }

  speak(value: Readable | Uint8Array, volume:number = 1) {
    const raw = decode(value, volume);
    this.inputPorts[0].write(raw);
  }

  ring(value: Readable | Uint8Array, volume:number = 1) {
    const raw = decode(value, volume);
    this.inputPorts[1].write(raw);
  }
}

const ZERO = Buffer.alloc(960 * 2 * 2);
function mix(value1: Buffer = ZERO, value2: Buffer = ZERO): Buffer {
  const buf = Buffer.alloc(960 * 2 * 2);
  for (let i = 0; i < buf.length; i += 2) {
    const n = value1.readInt16LE(i) + value2.readInt16LE(i);
    const n2 = Math.max(-32767, Math.min(32767, n));
    buf.writeInt16LE(n2, i);
  }
  return buf;
}

function decode(value: Readable | Uint8Array, volume:number = 1) {
  const demuxer = new prism.opus.OggDemuxer();
  const decoder = new prism.opus.Decoder({
    rate: 48000,
    channels: 2,
    frameSize: 960,
  });
  const volumeTransformer:any = new prism.VolumeTransformer({ type: 's16le', volume: volume });

  demuxer.pipe(decoder).pipe(volumeTransformer)

  if (value instanceof Readable) {
    value.pipe(demuxer);
  } else {
    demuxer.end(value);
  }

  return volumeTransformer;
}

function takeoverablePort<T>(): Port<T> {
  let iterator: AsyncIterator<T> = (async function* () {})();
  let iterable_done = false;

  let transferring_resolve = () => {};
  let transferring = Promise.resolve();

  const loop = (async function* () {
    while (true) {
      for (
        let rslt = await iterator.next();
        !rslt.done;
        rslt = await iterator.next()
      ) {
        yield rslt.value;
      }
      iterable_done = true;
      transferring = new Promise((r) => (transferring_resolve = r));
      while (iterable_done) {
        yield undefined;
      }
    }
  })();

  return {
    next: nextOrUndefined(loop),
    write: (value) => {
      iterator = value[Symbol.asyncIterator]();
      iterable_done = false;
      transferring_resolve();
    },
    get transferring() {
      return transferring;
    },
  };
}

function queuedPort<T>(): Port<T> {
  let iterable: AsyncIterable<T> = (async function* () {})();
  let iterable_done = false;
  let queue: AsyncIterable<T>[] = [];

  let transferring_resolve = () => {};
  let transferring = Promise.resolve();

  const loop = (async function* () {
    while (true) {
      yield* iterable;
      const iter = queue.shift();
      if (!iter) {
        iterable_done = true;
        transferring = new Promise((r) => (transferring_resolve = r));
      } else {
        iterable = iter;
      }

      while (iterable_done) {
        yield undefined;
      }
    }
  })();

  return {
    next: nextOrUndefined(loop),
    write: (value) => {
      queue.push(value);
      iterable_done = false;
      transferring_resolve();
    },
    get transferring() {
      return transferring;
    },
  };
}

type InfiniteAsyncIterator<T> = AsyncIterator<T>;
function nextOrUndefined<T>(source: InfiniteAsyncIterator<T>) {
  let last = { done: false, value: undefined } as IteratorResult<T | undefined>;
  let fulfilled = true;
  return () => {
    const current = last;
    if (current.done) {
      throw "The source must be InfiniteAsyncIterator.";
    }
    if (fulfilled) {
      fulfilled = false;
      source.next().then((x) => {
        fulfilled = true;
        last = x;
      });
    }
    return current.value;
  };
}
