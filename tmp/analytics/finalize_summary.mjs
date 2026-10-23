import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = "C:/Users/loyalty/source/PchilkaWebApp";
const inputPath = path.join(root, "tmp/analytics/final_intermediate.xlsx");
const outputDir = path.join(root, "outputs/analytics-shock-price-20260908");
const outputPath = path.join(outputDir, "Шок ціна з 01.09 по 07.09.26 - зведення.xlsx");
const previewDir = path.join(root, "tmp/analytics/final_previews");
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
workbook.recalculate();

const keyRanges = ["A1:Z42", "AA1:AZ42", "BA1:BS42"];
for (let i = 0; i < keyRanges.length; i++) {
  const inspect = await workbook.inspect({
    kind: "table",
    sheetId: "TDSheet",
    range: keyRanges[i],
    include: "values,formulas",
    tableMaxRows: 8,
    tableMaxCols: 26,
    tableMaxCellChars: 100,
    maxChars: 14000,
  });
  console.log(`CHECK ${keyRanges[i]}\n${inspect.ndjson}`);
  const preview = await workbook.render({ sheetName: "TDSheet", range: keyRanges[i], scale: 1.2, format: "png" });
  await fs.writeFile(path.join(previewDir, `section-${i + 1}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(`ERROR_SCAN\n${errors.ndjson}`);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`OUTPUT ${outputPath}`);
