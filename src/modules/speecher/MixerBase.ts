interface InputPort<T> {
  write(value: AsyncIterable<T>): void;
}

interface OutputPort<T> {
  next(): T | undefined;
  readonly transferring: Promise<void>;
}

export type Port<T> = InputPort<T> & OutputPort<T>;

type millisecond = number;
export abstract class MixerBase<
  Out,
  Ports extends Port<unknown>[],
  InputPorts extends {
    [P in keyof Ports]: Ports[P] extends InputPort<infer U>
      ? InputPort<U>
      : never;
  } = {
    [P in keyof Ports]: Ports[P] extends InputPort<infer U>
      ? InputPort<U>
      : never;
  },
  Values extends {
    [P in keyof Ports]: Ports[P] extends OutputPort<infer U>
      ? ReturnType<OutputPort<U>["next"]>
      : never;
  } = {
    [P in keyof Ports]: Ports[P] extends OutputPort<infer U>
      ? ReturnType<OutputPort<U>["next"]>
      : never;
  }
> implements AsyncIterable<Out> {
  private _generator: AsyncIterator<Out>;
  private _inputPorts: Ports;

  constructor(period: millisecond, mix: (...values: Values) => Out, ...ports: Ports) {
    this._inputPorts = ports;

    this._generator = (async function* () {
      while (true) {
        await Promise.race(ports.map((x) => x.transferring));
        await new Promise((f) => setTimeout(f, period));
        yield mix(...(ports.map((x) => x.next()) as Values));
      }
    })();
  }

  get inputPorts(): InputPorts {
    return (this._inputPorts as unknown) as InputPorts;
  }

  [Symbol.asyncIterator]() {
    return this._generator;
  }
}
