import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const base = "C:/Users/loyalty/source/PchilkaWebApp/tmp/analytics/normalized";
const out = "C:/Users/loyalty/source/PchilkaWebApp/tmp/analytics/previews";
await fs.mkdir(out, { recursive: true });
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(base, "Шок ціна з 01.09 по 07.09.26.xlsx")));
console.log(wb.help("range.insert", { include: "index,examples,notes", maxChars: 5000 }).ndjson);
const img = await wb.render({ sheetName: "TDSheet", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(path.join(out, "template.png"), new Uint8Array(await img.arrayBuffer()));
