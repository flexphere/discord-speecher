export class TakeoverablePort<T, Nosignal>
  implements AsyncIterable<T | Nosignal>
{
  private _nosignal: Nosignal;
  private currentSrc?: AsyncIterable<T>;
  private loop: AsyncIterator<T | Nosignal>;

  constructor(nosignal: Nosignal) {
    this._nosignal = nosignal;
    this.currentSrc = undefined;
    this.loop = (async function* gen(self) {
      while (true) {
        nextSrc: while (self.currentSrc) {
          const _src = self.currentSrc;
          for await (const e of _src) {
            yield e;
            if (_src !== self.currentSrc) {
              continue nextSrc;
            }
          }
          self.currentSrc = undefined;
        }
        while (!self.currentSrc) {
          yield self._nosignal;
        }
      }
    })(this);
  }

  get nosignal() {
    return this._nosignal;
  }

  push(src: AsyncIterable<T>) {
    this.currentSrc = src;
  }

  [Symbol.asyncIterator]() {
    return this.loop;
  }
}
