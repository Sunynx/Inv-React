import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { thSarabunNewBase64 as sarabunBase64 } from './fonts/thSarabunNewBase64';

export async function exportToExcel(data: any, options: { filename: string, includeSummary?: boolean }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RPM IT Inventory System';
  workbook.created = new Date();

  // Helper to style sheets
  const styleSheet = (sheet: ExcelJS.Worksheet, headerRowIndex: number = 1) => {
    const headerRow = sheet.getRow(headerRowIndex);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } }; // RPM Navy Blue
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Auto filter
    const lastColIndex = sheet.columns?.length || 1;
    const lastColLetter = String.fromCharCode(64 + lastColIndex);
    sheet.autoFilter = `A${headerRowIndex}:${lastColLetter}${headerRowIndex}`;

    // Add borders to all cells
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
        };
      });
    });
  };

  // Create Summary Sheet
  if (options.includeSummary) {
    const summarySheet = workbook.addWorksheet('Summary Report');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 35 },
      { header: 'Value', key: 'value', width: 25 },
    ];
    
    // Add title
    summarySheet.insertRow(1, ['RPM IT Inventory System - Export Summary']);
    summarySheet.mergeCells('A1:B1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF1B365D' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    summarySheet.getRow(1).height = 30;

    // We pushed headers to row 2
    summarySheet.getRow(2).values = ['Metric', 'Value'];
    
    summarySheet.addRow({ metric: 'Generated On', value: format(new Date(), 'dd MMM yyyy HH:mm') });
    if (data.assets) summarySheet.addRow({ metric: 'Total Assets Exported', value: data.assets.length });
    if (data.tickets) summarySheet.addRow({ metric: 'Total Tickets Exported', value: data.tickets.length });
    if (data.maintenance) summarySheet.addRow({ metric: 'Maintenance Logs Exported', value: data.maintenance.length });
    if (data.stock) summarySheet.addRow({ metric: 'Stock Movements Exported', value: data.stock.length });
    if (data.audit) summarySheet.addRow({ metric: 'Audit Logs Exported', value: data.audit.length });

    styleSheet(summarySheet, 2);
  }

  // Assets Sheet
  if (data.assets && data.assets.length > 0) {
    const sheet = workbook.addWorksheet('Assets');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'แผนก', key: 'department', width: 20 },
      { header: 'Old User', key: 'previous_user', width: 25 },
      { header: 'Assigned User', key: 'user', width: 25 },
      { header: 'Model', key: 'model', width: 20 },
      { header: 'CPU', key: 'cpu', width: 20 },
      { header: 'RAM', key: 'ram', width: 15 },
      { header: 'Purchase Date', key: 'purchase_date', width: 15 },
      { header: 'Price (THB)', key: 'price', width: 15 },
    ];
    sheet.getRow(1).font = { bold: true };
    data.assets.forEach((a: any) => {
      sheet.addRow({
        name: a.name,
        category: a.categories?.name || '-',
        brand: a.brand || '-',
        department: a.departments?.name || '-',
        previous_user: a.previous_user || '-',
        user: a.assigned_user,
        model: a.model || '-',
        cpu: a.cpu || '-',
        ram: a.ram || '-',
        purchase_date: a.purchase_date ? format(new Date(a.purchase_date), 'dd MMM yyyy') : '-',
        price: a.price || 0
      });
    });
    styleSheet(sheet, 1);
  }

  // Tickets Sheet
  if (data.tickets && data.tickets.length > 0) {
    const sheet = workbook.addWorksheet('Repair Tickets');
    sheet.columns = [
      { header: 'Ticket Number', key: 'ticket_number', width: 20 },
      { header: 'Issue', key: 'issue_description', width: 40 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Priority', key: 'priority', width: 15 },
      { header: 'Asset Code', key: 'asset_code', width: 20 },
      { header: 'Reported By', key: 'reported_by', width: 20 },
      { header: 'Created At', key: 'created_at', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    data.tickets.forEach((t: any) => {
      sheet.addRow({
        ticket_number: t.id ? t.id.substring(0, 8) : '-',
        issue_description: t.description || t.title,
        status: t.status,
        priority: t.priority,
        asset_code: t.assets?.asset_code || '-',
        reported_by: t.reported_by,
        created_at: t.created_at ? format(new Date(t.created_at), 'dd MMM yyyy HH:mm') : '-',
      });
    });
    styleSheet(sheet, 1);
  }

  // Stock Sheet
  if (data.stock && data.stock.length > 0) {
    const sheet = workbook.addWorksheet('Stock Movements');
    sheet.columns = [
      { header: 'Date', key: 'created_at', width: 20 },
      { header: 'Item Name', key: 'item_name', width: 30 },
      { header: 'Type', key: 'transaction_type', width: 15 },
      { header: 'Quantity', key: 'quantity', width: 15 },
      { header: 'Reference', key: 'reference', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    sheet.getRow(1).font = { bold: true };
    data.stock.forEach((s: any) => {
      sheet.addRow({
        created_at: s.created_at ? format(new Date(s.created_at), 'dd MMM yyyy HH:mm') : '-',
        item_name: s.stock_items?.name || '-',
        transaction_type: s.transaction_type,
        quantity: s.quantity,
        reference: s.reference_number,
        notes: s.notes,
      });
    });
    styleSheet(sheet, 1);
  }

  // Maintenance Sheet
  if (data.maintenance && data.maintenance.length > 0) {
    const sheet = workbook.addWorksheet('Maintenance Logs');
    sheet.columns = [
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Asset Code', key: 'asset_code', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Scheduled Date', key: 'next_due_at', width: 20 },
      { header: 'Frequency', key: 'frequency', width: 15 },
      { header: 'Performed By', key: 'performed_by', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    data.maintenance.forEach((m: any) => {
      sheet.addRow({
        title: m.title || '-',
        asset_code: m.assets?.asset_code || '-',
        status: m.status,
        next_due_at: m.next_due_at ? format(new Date(m.next_due_at), 'dd MMM yyyy') : '-',
        frequency: m.frequency || '-',
        performed_by: m.performed_by || '-',
      });
    });
    styleSheet(sheet, 1);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${options.filename}.xlsx`);
}

export function exportToPDF(data: any, options: { filename: string, includeSummary?: boolean }) {
  const doc = new jsPDF('landscape');
  
  // Add Thai Font
  doc.addFileToVFS('Sarabun.ttf', sarabunBase64);
  doc.addFont('Sarabun.ttf', 'Sarabun', 'normal');
  doc.setFont('Sarabun');

  const primaryColor: [number, number, number] = [27, 54, 93]; // RPM Navy Blue

  let currentY = 15;

  // Title
  doc.setFontSize(24);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('RPM IT Inventory System Report', 14, currentY);
  currentY += 10;
  
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, currentY);
  currentY += 15;

  let firstTable = true;

  // Helper to add spacing between tables or pages
  const checkPageBreak = (neededSpace: number) => {
    if (currentY + neededSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      currentY = 20;
      return true;
    }
    return false;
  };

  // Assets
  if (data.assets && data.assets.length > 0) {
    if (!firstTable) { checkPageBreak(30); doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Asset Inventory (${data.assets.length})`, 14, currentY);
    
    const assetBody = data.assets.map((a: any) => [
      a.name || '-',
      a.categories?.name || '-',
      a.brand || '-',
      a.departments?.name || '-',
      a.previous_user || '-',
      a.assigned_user || '-',
      a.model || '-',
      a.cpu || '-',
      a.ram || '-'
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Name', 'Category', 'Brand', 'แผนก', 'Old User', 'Assigned User', 'Model', 'CPU', 'RAM']],
      body: assetBody,
      headStyles: { fillColor: primaryColor, font: 'Sarabun', fontSize: 14 },
      styles: { font: 'Sarabun', fontSize: 12 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
    firstTable = false;
  }

  // Tickets
  if (data.tickets && data.tickets.length > 0) {
    if (!firstTable) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Repair Tickets (${data.tickets.length})`, 14, currentY);
    
    const ticketBody = data.tickets.map((t: any) => [
      t.id ? t.id.substring(0, 8) : '-',
      t.description || t.title || '-',
      t.status || '-',
      t.priority || '-',
      t.assets?.asset_code || '-',
      t.created_at ? format(new Date(t.created_at), 'dd MMM yyyy') : '-'
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Ticket #', 'Issue', 'Status', 'Priority', 'Asset Code', 'Date']],
      body: ticketBody,
      headStyles: { fillColor: primaryColor, font: 'Sarabun', fontSize: 14 },
      styles: { font: 'Sarabun', fontSize: 12 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
    firstTable = false;
  }

  // Stock
  if (data.stock && data.stock.length > 0) {
    if (!firstTable) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Stock Movements (${data.stock.length})`, 14, currentY);
    
    const stockBody = data.stock.map((s: any) => [
      s.created_at ? format(new Date(s.created_at), 'dd MMM yyyy') : '-',
      s.stock_items?.name || '-',
      s.transaction_type || '-',
      s.quantity?.toString() || '0',
      s.reference_number || '-',
      s.notes || '-'
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Date', 'Item', 'Type', 'Qty', 'Reference', 'Notes']],
      body: stockBody,
      headStyles: { fillColor: primaryColor, font: 'Sarabun', fontSize: 14 },
      styles: { font: 'Sarabun', fontSize: 12 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
    firstTable = false;
  }

  // Maintenance
  if (data.maintenance && data.maintenance.length > 0) {
    if (!firstTable) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Maintenance Logs (${data.maintenance.length})`, 14, currentY);
    
    const maintenanceBody = data.maintenance.map((m: any) => [
      m.title || '-',
      m.assets?.asset_code || '-',
      m.status || '-',
      m.next_due_at ? format(new Date(m.next_due_at), 'dd MMM yyyy') : '-',
      m.frequency || '-',
      m.performed_by || '-'
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Title', 'Asset Code', 'Status', 'Scheduled Date', 'Frequency', 'Performed By']],
      body: maintenanceBody,
      headStyles: { fillColor: primaryColor, font: 'Sarabun', fontSize: 14 },
      styles: { font: 'Sarabun', fontSize: 12 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
    firstTable = false;
  }

  doc.save(`${options.filename}.pdf`);
}
