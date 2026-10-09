/// <reference lib="webworker" />
import type { OverpassResponse } from './data/osm';
import { processCity, type CityResult, type PipelineStep } from './geo/pipeline';

export type WorkerRequest = {
  type: 'process';
  raw: { boundary: OverpassResponse; streets: OverpassResponse };
  /** Prefer name:he (Israeli cities); otherwise the local name. */
  hebrewNames: boolean;
};

export type WorkerResponse =
  | { type: 'progress'; step: PipelineStep; fraction: number }
  | { type: 'done'; result: CityResult }
  | { type: 'error'; message: string };

const post = (msg: WorkerResponse) => self.postMessage(msg);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  if (e.data.type !== 'process') return;
  try {
    const { raw, hebrewNames } = e.data;
    const result = processCity(
      raw,
      (step, fraction) => post({ type: 'progress', step, fraction }),
      { hebrewNames },
    );
    post({ type: 'done', result });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
