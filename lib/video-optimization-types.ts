export type VideoOptimizationJob = {
  id: string; status: 'queued' | 'running' | 'completed' | 'failed';
  originalUrl: string; outputUrl?: string; keepOriginal: boolean; originalDeleted: boolean;
  originalBytes?: number; outputBytes?: number; createdAt: string; updatedAt: string; message?: string;
};
export function isOptimizableVideo(value: string) { return /\.(mp4|webm|mov|m4v)$/i.test(value.split(/[?#]/)[0]); }
