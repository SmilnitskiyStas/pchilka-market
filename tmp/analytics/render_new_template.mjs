import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = "C:/Users/loyalty/source/PchilkaWebApp";
const input = path.join(root, "tmp/analytics/new_normalized/Шок ціна з 01.09 по 08.09.26.xlsx");
const output = path.join(root, "tmp/analytics/new_template_preview.png");
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
console.log((await wb.inspect({
  kind: "table",
  sheetId: "TDSheet",
  range: "A1:BA40",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 53,
  maxChars: 18000,
})).ndjson);
const img = await wb.render({ sheetName: "TDSheet", range: "A1:BA40", scale: 1.25, format: "png" });
await fs.writeFile(output, new Uint8Array(await img.arrayBuffer()));
console.log(output);
