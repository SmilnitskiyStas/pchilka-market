import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import path from "node:path";

const base = "C:/Users/loyalty/source/PchilkaWebApp/tmp/analytics/normalized";
for (const name of ["Отчет-1-7,09.xlsx", "Отчет-25-31,08.xlsx", "Шок ціна з 01.09 по 07.09.26.xlsx"]) {
  try {
    const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(base, name)));
    console.log(`### ${name}`);
    console.log((await wb.inspect({ kind: "sheet,table", include: "id,name,values,formulas", tableMaxRows: 8, tableMaxCols: 12, maxChars: 10000 })).ndjson);
  } catch (err) {
    console.log(`FAILED ${name}: ${err?.message ?? err}`);
  }
}
