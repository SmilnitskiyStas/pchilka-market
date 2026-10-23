import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const base = "C:/Users/loyalty/source/PchilkaWebApp/tmp/analytics/normalized";
for (const name of ["Отчет-25-31,08.xlsx", "Отчет-1-7,09.xlsx", "Шок ціна з 01.09 по 07.09.26.xlsx"]) {
  const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(base, name)));
  const ws = wb.worksheets.getItem("TDSheet");
  const used = ws.getUsedRange();
  console.log(`\n### ${name} ${used.address}`);
  console.log("headers:", JSON.stringify(ws.getRangeByIndexes(0, 0, Math.min(5, used.rowCount), used.columnCount).values));
  console.log("stores:", JSON.stringify(ws.getRangeByIndexes(Math.min(3, used.rowCount-1), 0, used.rowCount-Math.min(3, used.rowCount-1), 1).values.flat()));
}
