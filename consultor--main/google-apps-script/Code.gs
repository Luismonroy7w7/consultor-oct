/**
 * Backend de Ruta de Comercios para Google Apps Script.
 * La hoja actual se conserva como fuente de comercios. Al primer registro crea
 * automáticamente una pestaña llamada "Visitas".
 */ const SPREADSHEET_ID = "1ci_qklNZt7_k6_aktOgbZGv5CJ9IPgxSTz1baQHhpaY";
const VISITS_SHEET_NAME = "Visitas";
function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Ruta de comercios")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
function getAppData() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sourceSheet = spreadsheet
    .getSheets()
    .find((sheet) => sheet.getName() !== VISITS_SHEET_NAME);
  if (!sourceSheet) throw new Error("No se encontró la pestaña de comercios.");
  const values = sourceSheet.getDataRange().getDisplayValues();
  const [headers, ...rows] = values;
  const merchants = rows
    .filter((row) => row.some((value) => value !== ""))
    .map((row, id) => {
      const merchant = {
        id,
      };
      headers.forEach(
        (header, column) =>
          (merchant[header.replace(/^\uFEFF/, "")] = row[column] || ""),
      );
      return merchant;
    });
  return {
    merchants,
    visits: getLatestVisits_(spreadsheet),
    visitHistory: getVisitHistory_(spreadsheet),
  };
}
function recordVisit(visit) {
  if (!visit || visit.merchantId === undefined || !visit.type)
    throw new Error("Faltan datos para registrar la visita.");
  const sheet = getOrCreateVisitsSheet_(
    SpreadsheetApp.openById(SPREADSHEET_ID),
  );
  sheet.appendRow([
    new Date(visit.date || Date.now()),
    Number(visit.merchantId),
    visit.email || "",
    visit.merchantName || "",
    visit.contactName || "",
    visit.type,
    visit.notes || "",
    Session.getActiveUser().getEmail() || "Consultor",
  ]);
  return {
    ok: true,
  };
}
function addMerchant(merchant) {
  if (
    !merchant ||
    !merchant["Nombre Comercio"] ||
    !isFinite(Number(merchant.Latitud)) ||
    !isFinite(Number(merchant.Longitud))
  )
    throw new Error("El comercio necesita nombre y coordenadas válidas.");
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet
    .getSheets()
    .find((candidate) => candidate.getName() !== VISITS_SHEET_NAME);
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  let headers = headerRange.getValues()[0];
  if (!headers.includes("Dirección")) {
    sheet.insertColumnAfter(headers.length);
    sheet.getRange(1, headers.length + 1).setValue("Dirección");
    headers.push("Dirección");
  }
  sheet.appendRow(headers.map((header) => merchant[header] || ""));
  return getAppData();
}
function deleteVisit(rowNumber) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VISITS_SHEET_NAME);
  const row = Number(rowNumber);
  if (!sheet || !Number.isInteger(row) || row < 2 || row > sheet.getLastRow())
    throw new Error("No se encontró la visita que deseas eliminar.");
  sheet.deleteRow(row);
  return getAppData();
}
function getOrCreateVisitsSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(VISITS_SHEET_NAME);
  if (sheet) return sheet;
  sheet = spreadsheet.insertSheet(VISITS_SHEET_NAME);
  sheet.appendRow([
    "Fecha",
    "ID comercio",
    "Email",
    "Comercio",
    "Contacto",
    "Motivo",
    "Notas",
    "Registrado por",
  ]);
  sheet.setFrozenRows(1);
  sheet
    .getRange("A1:H1")
    .setFontWeight("bold")
    .setBackground("#0b6b55")
    .setFontColor("#ffffff");
  sheet.setColumnWidths(1, 8, 145);
  sheet.setColumnWidth(7, 300);
  return sheet;
}
function getLatestVisits_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(VISITS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  return rows.reduce((latest, row) => {
    latest[row[1]] = {
      date: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      type: row[5],
      notes: row[6],
    };
    return latest;
  }, {});
}
function getVisitHistory_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(VISITS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 8)
    .getValues()
    .map((row, index) => ({
      row: index + 2,
      date: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      merchantId: Number(row[1]),
      email: row[2],
      merchantName: row[3],
      contactName: row[4],
      type: row[5],
      notes: row[6],
      recordedBy: row[7],
    }));
}
