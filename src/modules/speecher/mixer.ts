import {VoiceConnection} from '@discordjs/voice';
import { Readable, pipeline } from "stream";
import { once } from "events";
import { BufferedPort } from "./mixer/BufferedPort";
import { TakeoverablePort } from "./mixer/TakeoverablePort";
import { autoPlay } from "./mixer/autoPlay";

export function speak(
  connection: VoiceConnection,
  source: Readable | Uint8Array,
  volume: number = 1
) {
  const src = decode(source, volume);
  getMixer(connection)[0](src);
}
export function ring(
  connection: VoiceConnection,
  source: Readable | Uint8Array,
  volume: number = 1
) {
  const src = decode(source, volume);
  getMixer(connection)[1](src);
}

function decode(source: Readable | Uint8Array, volume: number = 1) {
  const demuxer = new prism.opus.OggDemuxer();
  if (source instanceof Readable) {
    source.pipe(demuxer);
  } else {
    demuxer.end(source);
  }

  const decoder = demuxer.pipe(newDecoder());

  return volume == 1 ? decoder : decoder.pipe(newVolume(volume));
}

type Mixer = ReturnType<typeof createMixer>;
type Play = (src: Readable) => Promise<void>;

const mixers = new WeakMap<VoiceConnection, Mixer>();

function getMixer(connection: VoiceConnection) {
  let mixer = mixers.get(connection);
  if (!mixer) {
    const play = (src: Readable) => {
      const dispatcher = connection.play(src, { volume: false, type: "opus" });
      return once(dispatcher, "finish") as unknown as Promise<void>;
    };

    mixer = createMixer(play);
    mixers.set(connection, mixer);
  }
  return mixer;
}

const rethrow = (e: any) => {
  if (e) {
    throw e;
  }
};

function createMixer(play: Play) {
  return autoPlay(
    (src) => {
      const mixer = pipeline(src, mix, newEncoder(), rethrow);
      return play(mixer);
    },
    new BufferedPort<Buffer, undefined>(undefined),
    new TakeoverablePort<Buffer, undefined>(undefined)
  );
}

async function* mix(
  src: AsyncIterable<[Buffer | undefined, Buffer | undefined]>
) {
  const ZERO = Buffer.alloc(960 * 2 * 2);

  for await (const [v1 = ZERO, v2 = ZERO] of src) {
    yield mix(v1, v2);
  }

  function mix(value1: Buffer, value2: Buffer): Buffer {
    const buf = Buffer.alloc(960 * 2 * 2);
    for (let i = 0; i < buf.length; i += 2) {
      const n = value1.readInt16LE(i) + value2.readInt16LE(i);
      const n2 = Math.max(-32767, Math.min(32767, n));
      buf.writeInt16LE(n2, i);
    }
    return buf;
  }
}

import prism from "prism-media";

const opusOptions = {
  rate: 48000,
  channels: 2,
  frameSize: 960,
};

function newDecoder() {
  return new prism.opus.Decoder(opusOptions);
}
function newEncoder() {
  return new prism.opus.Encoder(opusOptions);
}
function newVolume(volume: number) {
  return new prism.VolumeTransformer({
    type: "s16le",
    volume,
    objectMode: true,
  } as any);
}
