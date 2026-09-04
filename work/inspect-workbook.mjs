import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const source = "C:/Users/salma/Downloads/SG_Motorcycle_Model_Master_2010plus (1).xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));

const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 24,
  tableMaxCellChars: 120,
});
console.log(summary.ndjson);

const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 4000 });
console.log("---SHEETS---");
console.log(sheets.ndjson);
