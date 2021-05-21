export class BufferedPort<T, Nosignal> implements AsyncIterable<T | Nosignal> {
  private _nosignal: Nosignal;
  private buffer: AsyncIterable<T>[];
  private loop: AsyncIterator<T | Nosignal>;

  constructor(nosignal: Nosignal) {
    this._nosignal = nosignal;
    this.buffer = [];
    this.loop = (async function* gen(self) {
      while (true) {
        const src = self.buffer.shift();
        if (src) {
          yield* src;
        } else {
          yield self._nosignal;
        }
      }
    })(this);
  }

  get nosignal() {
    return this._nosignal;
  }

  push(src: AsyncIterable<T>) {
    this.buffer.push(src);
  }

  [Symbol.asyncIterator]() {
    return this.loop;
  }
}
