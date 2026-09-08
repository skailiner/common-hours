import { validate, type Roster } from './roster.ts';
import type { Schedule } from './scheduler.ts';
export type WorkerLike = {
  onmessage: ((e: MessageEvent) => unknown) | null;
  onerror: ((e: ErrorEvent) => unknown) | null;
  postMessage: (message: unknown, transfer: Transferable[]) => void;
  terminate: () => void;
};
export class Runner {
  private active: { worker: WorkerLike; reject: (e: Error) => void } | null =
    null;
  private disposed = false;
  private factory: () => WorkerLike;
  constructor(factory: () => WorkerLike) {
    this.factory = factory;
  }
  get busy() {
    return this.active !== null;
  }
  run(
    input: Roster,
    progress: (filled: number, total: number) => void,
  ): Promise<Schedule> {
    if (this.disposed || this.busy)
      return Promise.reject(new Error('The planner is closed or busy.'));
    let roster: Roster;
    try {
      roster = validate(input);
    } catch (e) {
      return Promise.reject(e);
    }
    return new Promise((resolve, reject) => {
      let worker: WorkerLike;
      try {
        worker = this.factory();
      } catch {
        reject(
          new Error(
            'The local planner could not start. Try a current browser.',
          ),
        );
        return;
      }
      const active = { worker, reject };
      this.active = active;
      const finish = (result?: Schedule, error?: Error) => {
        if (this.active !== active) return;
        this.active = null;
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
        if (error) reject(error);
        else resolve(result!);
      };
      worker.onmessage = (e) => {
        if (this.active !== active) return;
        const d = e.data;
        if (
          d?.type === 'progress' &&
          Number.isSafeInteger(d.filled) &&
          d.filled >= 0 &&
          d.total === roster.shifts.reduce((s, v) => s + v.needed, 0) &&
          d.filled <= d.total
        ) {
          progress(d.filled, d.total);
          return;
        }
        if (
          d?.type === 'result' &&
          d.result?.engine === 'common-hours-flow-v1'
        ) {
          finish(d.result);
          return;
        }
        finish(
          undefined,
          new Error(
            d?.type === 'error' && typeof d.message === 'string'
              ? d.message
              : 'Unexpected planner response.',
          ),
        );
      };
      worker.onerror = () =>
        finish(
          undefined,
          new Error(
            'Planning stopped unexpectedly. The previous roster and result remain.',
          ),
        );
      try {
        worker.postMessage({ roster }, []);
      } catch {
        finish(
          undefined,
          new Error('Could not send the roster to the local planner.'),
        );
      }
    });
  }
  cancel() {
    const a = this.active;
    if (!a) return;
    this.active = null;
    a.worker.onmessage = null;
    a.worker.onerror = null;
    a.worker.terminate();
    a.reject(new Error('Planning cancelled.'));
  }
  dispose() {
    this.disposed = true;
    this.cancel();
  }
}
