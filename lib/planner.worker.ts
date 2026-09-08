import { schedule, verifySchedule } from './scheduler.ts';
self.onmessage = (e: MessageEvent) => {
  try {
    const result = schedule(e.data?.roster, (filled, total) =>
      self.postMessage({ type: 'progress', filled, total }),
    );
    verifySchedule(e.data.roster, result);
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Planning failed.',
    });
  }
};
