import { playAndPause, Play } from "./playAndPause";

export type { Play } from "./playAndPause";

export interface Port<T, Nosignal> extends AsyncIterable<T | Nosignal> {
  nosignal: Nosignal;
  push(src: AsyncIterable<T>): void;
}

export function autoPlay<Ports extends PortArray>(
  play: Play<PortResults<Ports>>,
  ...ports: Ports
) {
  const src = zip(...ports) as AsyncIterable<PortResults<Ports>>;
  const pauseOn = playAndPause(src, play);

  const nosignals = ports.map((p) => p.nosignal);
  const allNosignal = (inputs: PortResults<Ports>) => {
    return inputs.every((e, i) => e === nosignals[i]);
  };

  return ports.map((p) => {
    return (src) => {
      p.push(src);
      pauseOn(allNosignal);
    };
  }) as PortPushs<Ports>;
}

type PortArray = Port<unknown, unknown>[];

type PortResults<Ports extends PortArray> = {
  [P in keyof Ports]: Ports[P] extends Port<infer U, infer V> ? U | V : never;
};

type PortPushs<Ports extends PortArray> = {
  [P in keyof Ports]: Ports[P] extends AsyncIterable<infer U>
    ? (_: AsyncIterable<U>) => void
    : never;
};

async function* zip<T extends AsyncIterable<unknown>[]>(...iterable: T) {
  const itors = iterable.map((x) => x[Symbol.asyncIterator]());
  while (true) {
    const results = await Promise.all(itors.map((x) => x.next()));
    if (results.some((x) => x.done)) {
      break;
    }
    yield results.map((x) => x.value) as {
      [P in keyof T]: T[P] extends AsyncIterable<infer U> ? U : never;
    };
  }
}
