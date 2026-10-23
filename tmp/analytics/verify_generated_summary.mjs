import fs from 'node:fs/promises';
import path from 'node:path';

import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const root = 'C:/Users/loyalty/source/PchilkaWebApp';
const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'docs/Analytics/Шок ціна з 01.09 по 07.09.26.xlsx');
const previewDir = path.join(root, 'tmp/analytics/generated_previews');
await fs.mkdir(previewDir, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
workbook.recalculate();

for (const [index, range] of ['A1:Z40', 'AA1:BA40'].entries()) {
  const inspected = await workbook.inspect({
    kind: 'table',
    sheetId: 'TDSheet',
    range,
    include: 'values,formulas',
    tableMaxRows: 40,
    tableMaxCols: 27,
    tableMaxCellChars: 80,
    maxChars: 30000,
  });
  console.log(`CHECK ${range}\n${inspected.ndjson}`);
  const preview = await workbook.render({ sheetName: 'TDSheet', range, scale: 1, format: 'png' });
  await fs.writeFile(path.join(previewDir, `section-${index + 1}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
  options: { useRegex: true, maxResults: 300 },
  summary: 'generated summary formula error scan',
});
console.log(`ERROR_SCAN\n${errors.ndjson}`);
