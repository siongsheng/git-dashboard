import { EventEmitter } from "node:events";

export interface RunStreamEvent {
  seq: number;
  eventType: string;
  payload: unknown;
}

// Per-run emitter used to fan streamed SDK messages out to SSE subscribers.
// A 'terminal' event signals the run is finished and streams should close.
export class RunEmitter extends EventEmitter {
  emitEvent(event: RunStreamEvent) {
    this.emit("event", event);
  }
  emitTerminal() {
    this.emit("terminal");
  }
}
