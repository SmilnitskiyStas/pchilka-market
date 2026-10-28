import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { buildMediaUrl, getUploadsDir, resolveUploadPath } from '@/lib/uploads';
import { getMediaMetadataMap, upsertMediaMetadata, removeMediaMetadata } from '@/lib/media-asset-metadata';
import { isOptimizableVideo, type VideoOptimizationJob } from '@/lib/video-optimization-types';

const execute = promisify(execFile);
type QueueState = { active: Map<string, string>; queue: Promise<unknown> };
const globalState = globalThis as typeof globalThis & { pchilkaVideoQueues?: Map<string, QueueState> };
function state() {
  const queues = globalState.pchilkaVideoQueues ??= new Map();
  const root = getUploadsDir();
  if (!queues.has(root)) queues.set(root, { active: new Map(), queue: Promise.resolve() });
  return queues.get(root)!;
}
const privateDirectory = () => path.join(getUploadsDir(), '.video-optimization');
const aliasFile = () => path.join(privateDirectory(), 'replacements.json');
function jobPath(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Невірний номер оптимізації.');
  return path.join(privateDirectory(), `${id}.json`);
}
function sourcePath(url: string) {
  if (!url.startsWith('/media/') || url.includes('?') || url.includes('#')) throw new Error('Оберіть завантажене відео з медіафайлів.');
  const parts = url.slice(7).split('/');
  if (parts.some((part) => decodeURIComponent(part).startsWith('.'))) throw new Error('Некоректний шлях до відео.');
  return resolveUploadPath(parts);
}
async function atomicJson(target: string, value: unknown) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(temporary, target); break; }
      catch (error) {
        if (attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }
  finally { await fs.rm(temporary, { force: true }); }
}
async function saveJob(job: VideoOptimizationJob) {
  job.updatedAt = new Date().toISOString(); await atomicJson(jobPath(job.id), job);
}
export async function getVideoReplacement(url: string): Promise<string | null> {
  try {
    const aliases = JSON.parse(await fs.readFile(aliasFile(), 'utf8')) as Record<string, string>;
    const target = aliases[url];
    if (!target || target === url) return null;
    await fs.access(sourcePath(target));
    return target;
  } catch { return null; }
}
async function addReplacement(original: string, output: string) {
  const aliases = JSON.parse(await fs.readFile(aliasFile(), 'utf8').catch(() => '{}')) as Record<string, string>;
  aliases[original] = output; await atomicJson(aliasFile(), aliases);
}
export async function getVideoOptimizationJob(id: string): Promise<VideoOptimizationJob> {
  const job = JSON.parse(await fs.readFile(jobPath(id), 'utf8')) as VideoOptimizationJob;
  if ((job.status === 'queued' || job.status === 'running') && !state().active.has(job.originalUrl) && Date.now() - Date.parse(job.updatedAt) > 25 * 60 * 1000) {
    job.status = 'failed'; job.message = 'Обробку перервано. Перевірте медіафайли та запустіть оптимізацію ще раз.'; await saveJob(job);
  }
  return job;
}
export async function listVideoOptimizationJobs() {
  const files = await fs.readdir(privateDirectory()).catch(() => []);
  const jobs = await Promise.all(files.filter((file) => /^[a-f0-9-]{36}\.json$/.test(file)).map((file) => getVideoOptimizationJob(file.slice(0, -5)).catch(() => null)));
  return jobs.filter((job): job is VideoOptimizationJob => !!job).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
}
async function probe(file: string) {
  const { stdout } = await execute(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height', '-of', 'json', file], { timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true });
  return JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type: string; codec_name: string; width: number; height: number }[] };
}
async function run(job: VideoOptimizationJob) {
  const source = sourcePath(job.originalUrl);
  const output = path.join(path.dirname(source), `${path.basename(source, path.extname(source))}-web-${job.id.slice(0, 8)}.mp4`);
  const temporary = path.join(privateDirectory(), `${job.id}.mp4`);
  try {
    job.status = 'running'; await saveJob(job);
    const before = await fs.stat(source); job.originalBytes = before.size;
    const input = await probe(source);
    const duration = Number(input.format?.duration);
    if (!input.streams?.some((stream) => stream.codec_type === 'video') || !Number.isFinite(duration) || duration <= 0 || duration > 900) throw new Error('Відео має бути коректним файлом тривалістю до 15 хвилин.');
    await execute(process.env.FFMPEG_PATH || 'ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', source, '-map', '0:v:0', '-map', '0:a:0?', '-vf', "scale=w='trunc(min(1280,iw)/2)*2':h=-2,fps=25", '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-maxrate', '2400k', '-bufsize', '4800k', '-pix_fmt', 'yuv420p', '-threads', '2', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-n', temporary], { timeout: 20 * 60 * 1000, maxBuffer: 1024 * 1024, windowsHide: true });
    const verified = await probe(temporary);
    const size = (await fs.stat(temporary)).size;
    if (!verified.streams?.some((stream) => stream.codec_type === 'video' && stream.codec_name === 'h264') || Math.abs(Number(verified.format?.duration) - duration) > Math.max(1, duration * 0.02) || !size) throw new Error('Не вдалося перевірити оптимізоване відео. Оригінал збережено.');
    if (size >= before.size) {
      job.status = 'completed'; job.outputUrl = job.originalUrl; job.outputBytes = before.size;
      job.message = 'Відео вже достатньо компактне. Залишено оригінал без змін.';
      await saveJob(job); return;
    }
    await fs.rename(temporary, output);
    const relative = path.relative(getUploadsDir(), output).split(path.sep);
    job.outputUrl = buildMediaUrl(relative); job.outputBytes = size;
    const metadata = await getMediaMetadataMap();
    await upsertMediaMetadata(job.outputUrl, metadata[job.originalUrl] ?? {});
    if (!job.keepOriginal) {
      const unchanged = await fs.stat(source);
      if (unchanged.size !== before.size || unchanged.mtimeMs !== before.mtimeMs) throw new Error('Оригінал змінився під час обробки. Його не видалено.');
      // Install the redirect before removing the old file, so existing links keep working.
      await addReplacement(job.originalUrl, job.outputUrl);
      await fs.unlink(source); job.originalDeleted = true;
      await removeMediaMetadata(job.originalUrl);
    }
    job.status = 'completed'; job.message = job.originalDeleted ? 'Відео оптимізовано, оригінал видалено. Старі посилання ведуть на нове відео.' : 'Відео оптимізовано. Оригінал залишено.';
    await saveJob(job);
  } catch (error) {
    if (job.originalDeleted && job.outputUrl) {
      job.status = 'completed'; job.message = 'Відео оптимізовано, оригінал видалено. Не вдалося оновити частину метаданих.'; await saveJob(job); return;
    }
    job.status = 'failed';
    const code = (error as NodeJS.ErrnoException).code;
    job.message = code === 'ENOENT' ? 'На сервері недоступний FFmpeg/FFprobe або вихідний файл. Оригінал не видалявся.' : error instanceof Error && !('cmd' in error) ? error.message : 'Не вдалося оптимізувати відео. Перевірте медіафайли; оригінал не видалявся.';
    await saveJob(job);
  } finally { await fs.rm(temporary, { force: true }); state().active.delete(job.originalUrl); }
}
export function isVideoOptimizationActive(url: string) { return state().active.has(url); }
export async function startVideoOptimization(originalUrl: string, keepOriginal = true) {
  if (!isOptimizableVideo(originalUrl)) throw new Error('Підтримуються MP4, WebM, MOV і M4V.');
  const source = sourcePath(originalUrl);
  const [realSource, realRoot] = await Promise.all([fs.realpath(source), fs.realpath(getUploadsDir())]);
  if (!realSource.startsWith(realRoot + path.sep)) throw new Error('Відео має знаходитися у сховищі медіафайлів.');
  originalUrl = buildMediaUrl(path.relative(realRoot, realSource).split(path.sep));
  const stat = await fs.lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024 * 1024) throw new Error('Оберіть відеофайл розміром до 512 МБ.');
  const { active } = state();
  const existingId = active.get(originalUrl);
  if (existingId) {
    const existing = await getVideoOptimizationJob(existingId);
    if (existing.keepOriginal !== keepOriginal) throw new Error('Це відео вже обробляється з іншим вибором збереження оригіналу.');
    return existing;
  }
  const job: VideoOptimizationJob = { id: randomUUID(), status: 'queued', originalUrl, keepOriginal, originalDeleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  active.set(originalUrl, job.id);
  try { await saveJob(job); }
  catch (error) { active.delete(originalUrl); throw error; }
  state().queue = state().queue.catch(() => {}).then(() => run(job)).catch(() => { active.delete(originalUrl); });
  return { ...job };
}
