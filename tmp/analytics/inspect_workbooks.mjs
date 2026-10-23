import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const base = "C:/Users/loyalty/source/PchilkaWebApp/docs/Analytics";
const outDir = "C:/Users/loyalty/source/PchilkaWebApp/tmp/analytics/previews";
await fs.mkdir(outDir, { recursive: true });

const names = [
  "Отчет-1-7,09.xlsx",
  "Отчет-25-31,08.xlsx",
  "Шок ціна з 01.09 по 07.09.26.xlsx",
];

for (const name of names) {
  const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(base, name)));
  console.log(`\n### ${name}`);
  console.log((await wb.inspect({ kind: "workbook,sheet", include: "id,name", maxChars: 12000 })).ndjson);
  const sheets = wb.worksheets.items;
  for (const sheet of sheets) {
    const used = sheet.getUsedRange();
    console.log(`-- ${sheet.name} used=${used?.address ?? "none"} tables=${sheet.tables.items.length} charts=${sheet.charts.items.length}`);
    if (used) {
      console.log((await wb.inspect({
        kind: "table",
        sheetId: sheet.name,
        range: used.address,
        include: "values,formulas",
        tableMaxRows: 18,
        tableMaxCols: 24,
        tableMaxCellChars: 120,
        maxChars: 18000,
      })).ndjson);
      const img = await wb.render({ sheetName: sheet.name, autoCrop: "all", scale: 1, format: "png" });
      const safe = `${path.parse(name).name}__${sheet.name}`.replace(/[<>:"/\\|?*]/g, "_");
      await fs.writeFile(path.join(outDir, `${safe}.png`), new Uint8Array(await img.arrayBuffer()));
    }
  }
}
