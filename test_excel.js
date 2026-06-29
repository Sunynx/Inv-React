const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/Sun/Desktop/RPM-IT-Inventory/Repair Notebook Screen legion.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log(JSON.stringify(data.slice(0, 50), null, 2));
