import { appendFile, mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';

import { getDbPool } from '@/lib/db';
import { writeInventoryProductImportLogFile, type InventoryProductImportLogFile } from '@/lib/inventory-import-log-files';
import {
  type InventoryProductImportLogItem,
  type InventoryProductImportRow,
  type InventoryProductImportSummary,
  importInventoryProductsToDb
} from '@/lib/inventory-products-repository';
import { getUploadsDir } from '@/lib/uploads';

const IMPORT_JOB_CHUNK_SIZE = 500;
const IMPORT_JOB_CHUNKS_PER_ADVANCE = 2;

export type InventoryImportJobState = 'queued' | 'processing' | 'completed' | 'failed';

export type InventoryImportJobStatus = {
  jobId: string;
  fileName: string;
  importedBy: string;
  state: InventoryImportJobState;
  percent: number;
  message: string;
  totalRows: number;
  processedRows: number;
  startedAt: string;
  updatedAt: string;
  finishedAt: string;
  summary: InventoryProductImportSummary | null;
  importLog: InventoryProductImportLogFile | null;
  logWarning: string;
  error: string;
  failedRowNumber?: number;
  failedExcelRowNumber?: number;
  failedRowData?: InventoryProductImportRow | null;
};

type InventoryImportJobPersistedStatus = InventoryImportJobStatus & {
  nextRowIndex: number;
  rowsFilePath: string;
  summaryLogFilePath: string;
};

function getImportLogsRoot() {
  return path.join(getUploadsDir(), 'admin', 'inventory', 'import-logs');
}

function getImportJobsRoot() {
  return path.join(getImportLogsRoot(), 'jobs');
}

function getImportLocksRoot() {
  return path.join(getImportJobsRoot(), 'locks');
}

function getImportRowsRoot() {
  return path.join(getUploadsDir(), 'admin', 'inventory', 'import-files');
}

function getImportJobStatusPath(jobId: string) {
  return path.join(getImportJobsRoot(), `${jobId}.json`);
}

function getImportJobLockPath(jobId: string) {
  return path.join(getImportLocksRoot(), `${jobId}.lock`);
}

function getImportRowsPath(jobId: string) {
  return path.join(getImportRowsRoot(), `${jobId}.rows.json`);
}

function getImportSummaryLogPath(jobId: string) {
  return path.join(getImportRowsRoot(), `${jobId}.summary-log.ndjson`);
}

function createEmptySummary(): InventoryProductImportSummary {
  return {
    created: 0,
    updated: 0,
    skipped: 0,
    needsReview: 0,
    total: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productsMatchedExisting: 0,
    barcodeEntriesAdded: 0,
    barcodeEntriesKept: 0,
    invalidRows: 0,
    log: []
  };
}

function mergeImportSummary(
  current: InventoryProductImportSummary,
  next: InventoryProductImportSummary,
  includeLog = false
): InventoryProductImportSummary {
  return {
    created: current.created + next.created,
    updated: current.updated + next.updated,
    skipped: current.skipped + next.skipped,
    needsReview: current.needsReview + next.needsReview,
    total: current.total + next.total,
    productsCreated: current.productsCreated + next.productsCreated,
    productsUpdated: current.productsUpdated + next.productsUpdated,
    productsMatchedExisting: current.productsMatchedExisting + next.productsMatchedExisting,
    barcodeEntriesAdded: current.barcodeEntriesAdded + next.barcodeEntriesAdded,
    barcodeEntriesKept: current.barcodeEntriesKept + next.barcodeEntriesKept,
    invalidRows: current.invalidRows + next.invalidRows,
    log: includeLog ? [...current.log, ...next.log] : current.log
  };
}

function buildProgressPercent(processedRows: number, totalRows: number) {
  if (totalRows <= 0) return 100;
  return Math.min(95, Math.round((processedRows / totalRows) * 90) + 5);
}

function resolveImportFailureDetails(error: unknown, rowOffset: number) {
  const fallbackMessage = error instanceof Error ? error.message : 'Невідома помилка імпорту.';
  const match = fallbackMessage.match(/^Рядок\s+(\d+):\s*(.*)$/u);
  if (!match) {
    return {
      failedRowNumber: rowOffset > 0 ? rowOffset + 1 : undefined,
      failedExcelRowNumber: rowOffset > 0 ? rowOffset + 2 : undefined,
      errorMessage: fallbackMessage
    };
  }

  const localRowNumber = Number(match[1]);
  const normalizedMessage = String(match[2] ?? '').trim() || fallbackMessage;
  if (!Number.isFinite(localRowNumber) || localRowNumber <= 0) {
    return {
      failedRowNumber: rowOffset > 0 ? rowOffset + 1 : undefined,
      failedExcelRowNumber: rowOffset > 0 ? rowOffset + 2 : undefined,
      errorMessage: fallbackMessage
    };
  }

  const failedRowNumber = rowOffset + localRowNumber;
  const failedExcelRowNumber = failedRowNumber + 1;
  return {
    failedRowNumber,
    failedExcelRowNumber,
    errorMessage: `Рядок ${failedRowNumber} (Excel ${failedExcelRowNumber}): ${normalizedMessage}`
  };
}

function toPublicImportJobStatus(status: InventoryImportJobPersistedStatus): InventoryImportJobStatus {
  const {
    nextRowIndex: _nextRowIndex,
    rowsFilePath: _rowsFilePath,
    summaryLogFilePath: _summaryLogFilePath,
    ...publicStatus
  } = status;
  return publicStatus;
}

async function ensureImportJobDirectories() {
  await mkdir(getImportJobsRoot(), { recursive: true });
  await mkdir(getImportLocksRoot(), { recursive: true });
  await mkdir(getImportRowsRoot(), { recursive: true });
  await mkdir(getImportLogsRoot(), { recursive: true });
}

async function writeImportJobStatus(status: InventoryImportJobPersistedStatus) {
  await ensureImportJobDirectories();
  await writeFile(getImportJobStatusPath(status.jobId), JSON.stringify(status, null, 2), 'utf8');
}

async function readPersistedImportJobStatus(jobId: string): Promise<InventoryImportJobPersistedStatus | null> {
  try {
    const raw = await readFile(getImportJobStatusPath(jobId), 'utf8');
    return JSON.parse(raw) as InventoryImportJobPersistedStatus;
  } catch {
    return null;
  }
}

async function readImportRows(rowsFilePath: string): Promise<InventoryProductImportRow[]> {
  const raw = await readFile(rowsFilePath, 'utf8');
  const parsed = JSON.parse(raw) as InventoryProductImportRow[];
  return Array.isArray(parsed) ? parsed : [];
}

async function appendImportSummaryLog(
  summaryLogFilePath: string,
  items: InventoryProductImportLogItem[],
  rowOffset: number
) {
  if (items.length === 0) return;

  const payload = items
    .map((item) =>
      JSON.stringify({
        ...item,
        rowNumber: item.rowNumber + rowOffset
      })
    )
    .join('\n');

  await appendFile(summaryLogFilePath, `${payload}\n`, 'utf8');
}

async function readImportSummaryLog(summaryLogFilePath: string): Promise<InventoryProductImportLogItem[]> {
  try {
    const raw = await readFile(summaryLogFilePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as InventoryProductImportLogItem);
  } catch {
    return [];
  }
}

async function acquireImportJobLock(jobId: string) {
  const lockPath = getImportJobLockPath(jobId);
  try {
    await mkdir(lockPath);
    return {
      async release() {
        await rm(lockPath, { recursive: true, force: true }).catch(() => undefined);
      }
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      return null;
    }

    throw error;
  }
}

export async function readImportJobStatus(jobId: string): Promise<InventoryImportJobStatus | null> {
  const status = await readPersistedImportJobStatus(jobId);
  return status ? toPublicImportJobStatus(status) : null;
}

export async function createInventoryImportJob(input: {
  fileName: string;
  importedBy: string;
  rows: InventoryProductImportRow[];
}): Promise<InventoryImportJobStatus> {
  await ensureImportJobDirectories();

  const now = new Date();
  const jobId = `inventory-import-${now.getTime()}`;
  const rowsFilePath = getImportRowsPath(jobId);
  const summaryLogFilePath = getImportSummaryLogPath(jobId);

  await writeFile(rowsFilePath, JSON.stringify(input.rows), 'utf8');
  await writeFile(summaryLogFilePath, '', 'utf8');

  const status: InventoryImportJobPersistedStatus = {
    jobId,
    fileName: input.fileName,
    importedBy: input.importedBy.trim() || 'admin',
    state: 'queued',
    percent: 1,
    message: 'Файл отримано. Готуємо імпорт...',
    totalRows: input.rows.length,
    processedRows: 0,
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    finishedAt: '',
    summary: createEmptySummary(),
    importLog: null,
    logWarning: '',
    error: '',
    failedRowNumber: undefined,
    failedExcelRowNumber: undefined,
    failedRowData: null,
    nextRowIndex: 0,
    rowsFilePath,
    summaryLogFilePath
  };

  await writeImportJobStatus(status);
  return toPublicImportJobStatus(status);
}

export async function advanceInventoryImportJob(jobId: string): Promise<InventoryImportJobStatus | null> {
  const existingStatus = await readPersistedImportJobStatus(jobId);
  if (!existingStatus) return null;

  if (existingStatus.state === 'completed' || existingStatus.state === 'failed') {
    return toPublicImportJobStatus(existingStatus);
  }

  const lock = await acquireImportJobLock(jobId);
  if (!lock) {
    const currentStatus = await readPersistedImportJobStatus(jobId);
    return currentStatus ? toPublicImportJobStatus(currentStatus) : null;
  }

  try {
    let status = (await readPersistedImportJobStatus(jobId)) ?? existingStatus;
    if (status.state === 'completed' || status.state === 'failed') {
      return toPublicImportJobStatus(status);
    }

    const rows = await readImportRows(status.rowsFilePath);
    let summary = status.summary ?? createEmptySummary();
    let nextRowIndex = Math.max(0, status.nextRowIndex || 0);
    let processedChunks = 0;

    status = {
      ...status,
      state: 'processing',
      percent: Math.max(status.percent, nextRowIndex > 0 ? buildProgressPercent(nextRowIndex, rows.length) : 5),
      message:
        nextRowIndex > 0
          ? `Продовжуємо імпорт: ${nextRowIndex} із ${rows.length} рядків уже оброблено...`
          : 'Файл прочитано. Починаємо імпорт рядків...',
      totalRows: rows.length,
      updatedAt: new Date().toISOString(),
      error: '',
      failedRowNumber: undefined,
      failedExcelRowNumber: undefined,
      failedRowData: null
    };
    await writeImportJobStatus(status);

    while (nextRowIndex < rows.length && processedChunks < IMPORT_JOB_CHUNKS_PER_ADVANCE) {
      const chunk = rows.slice(nextRowIndex, nextRowIndex + IMPORT_JOB_CHUNK_SIZE);
      const pool = getDbPool();
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();
        const chunkSummary = await importInventoryProductsToDb(chunk, connection, {
          changedBy: status.importedBy,
          changeSource: 'excel_import'
        });
        await connection.commit();
        summary = mergeImportSummary(summary, chunkSummary);
        await appendImportSummaryLog(status.summaryLogFilePath, chunkSummary.log, nextRowIndex);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      nextRowIndex += chunk.length;
      processedChunks += 1;
    }

    if (nextRowIndex >= rows.length) {
      const summaryWithLog: InventoryProductImportSummary = {
        ...summary,
        log: await readImportSummaryLog(status.summaryLogFilePath)
      };
      let importLog: InventoryProductImportLogFile | null = null;
      let logWarning = '';

      try {
        importLog = await writeInventoryProductImportLogFile({
          fileName: status.fileName,
          importedBy: status.importedBy,
          summary: summaryWithLog
        });
      } catch (logError) {
        logWarning =
          logError instanceof Error
            ? `Імпорт у базу завершено, але файл логу не вдалося зберегти: ${logError.message}`
            : 'Імпорт у базу завершено, але файл логу не вдалося зберегти.';
      }

      const completedStatus: InventoryImportJobPersistedStatus = {
        ...status,
        state: 'completed',
        percent: 100,
        message: 'Імпорт завершено.',
        totalRows: rows.length,
        processedRows: rows.length,
        updatedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        summary: summaryWithLog,
        importLog,
        logWarning,
        error: '',
        failedRowNumber: undefined,
        failedExcelRowNumber: undefined,
        failedRowData: null,
        nextRowIndex: rows.length
      };

      await writeImportJobStatus(completedStatus);
      await rm(completedStatus.rowsFilePath, { force: true }).catch(() => undefined);
      await rm(completedStatus.summaryLogFilePath, { force: true }).catch(() => undefined);
      return toPublicImportJobStatus(completedStatus);
    }

    const processingStatus: InventoryImportJobPersistedStatus = {
      ...status,
      state: 'processing',
      percent: buildProgressPercent(nextRowIndex, rows.length),
      message: `Оброблено ${nextRowIndex} із ${rows.length} рядків...`,
      totalRows: rows.length,
      processedRows: nextRowIndex,
      updatedAt: new Date().toISOString(),
      summary,
      nextRowIndex
    };

    await writeImportJobStatus(processingStatus);
    return toPublicImportJobStatus(processingStatus);
  } catch (error) {
    const failedStatus = await readPersistedImportJobStatus(jobId);
    if (!failedStatus) {
      throw error;
    }

    const rows = await readImportRows(failedStatus.rowsFilePath).catch(() => []);
    const failure = resolveImportFailureDetails(error, Math.max(0, failedStatus.nextRowIndex || 0));
    const failedRowData =
      failure.failedRowNumber && rows[failure.failedRowNumber - 1]
        ? rows[failure.failedRowNumber - 1]
        : null;

    const nextStatus: InventoryImportJobPersistedStatus = {
      ...failedStatus,
      state: 'failed',
      message: failure.failedRowNumber
        ? `Імпорт зупинено на рядку ${failure.failedRowNumber} (Excel ${failure.failedExcelRowNumber ?? failure.failedRowNumber + 1}).`
        : 'Імпорт зупинено через помилку.',
      updatedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      error: failure.errorMessage,
      failedRowNumber: failure.failedRowNumber,
      failedExcelRowNumber: failure.failedExcelRowNumber,
      failedRowData
    };

    await writeImportJobStatus(nextStatus);
    return toPublicImportJobStatus(nextStatus);
  } finally {
    await lock.release();
  }
}
