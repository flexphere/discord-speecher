type PauseOn<T> = (_: T) => boolean;
type Resume<T> = (_: PauseOn<T>) => void;
export type Play<T> = (src: AsyncIterable<T>) => Promise<void>;

export function playAndPause<T>(source: AsyncIterable<T>, play: Play<T>) {
  let resume: Resume<T>;

  // fire-and-forget
  (async () => {
    while (true) {
      const isBreak = await new Promise<PauseOn<T>>(
        (resolve) => (resume = resolve)
      );
      const isContinue = negate(isBreak);
      await play(takeWhile(source, isContinue));
    }
  })();

  return (pauseOn: PauseOn<T>) => resume(pauseOn);
}

function negate<T extends unknown[]>(pred: (...args: T) => boolean) {
  return function (this: any): boolean {
    return !pred.apply(this, arguments as any);
  } as (...args: T) => boolean;
}

async function* takeWhile<T>(iter: AsyncIterable<T>, pred: (_: T) => boolean) {
  const itor = iter[Symbol.asyncIterator]();
  while (true) {
    const result = await itor.next();
    if (result.done || !pred(result.value)) {
      break;
    }
    yield result.value;
  }
}
