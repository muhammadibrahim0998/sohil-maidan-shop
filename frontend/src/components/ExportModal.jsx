import React from 'react';
import { X, Download, MessageCircle, FileSpreadsheet, TrendingUp } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export function ExportModal({ isOpen, onClose, products = [], sales = [], categories = [] }) {

  if (!isOpen) return null;

  // --- ORIGINAL LOGIC UNTOUCHED ---
  const getStockStatus = (stock, minStock) => {
    if (stock === 0) return "Out of Stock";
    if (stock < minStock) return "Low Stock";
    return "In Stock";
  };

  const exportInventoryToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const allData = [...(products || [])];
    const lowStock = allData.filter(p => p.stock > 0 && p.stock <= p.minStock);
    const outOfStock = allData.filter(p => p.stock === 0);
    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

    const createInventorySheet = (name, data) => {
      const sheet = workbook.addWorksheet(name);
      sheet.mergeCells("A1:F1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = "NexFlow Inventory Report";
      titleCell.font = { size: 16, bold: true };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.mergeCells("A2:F2");
      const dateCell = sheet.getCell("A2");
      dateCell.value = `Date: ${new Date().toLocaleDateString("en-PK")}`;
      dateCell.alignment = { horizontal: "center" };
      for (let i = 1; i <= 6; i++) {
        sheet.getCell(1, i).border = borderStyle;
        sheet.getCell(2, i).border = borderStyle;
      }
      const headers = ["Product Name", "Category", "Stock", "Min Stock", "Price (Rs.)", "Status"];
      const headerRow = sheet.addRow(headers);
      headerRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.border = borderStyle;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4FD' } };
      });
      data.forEach(p => {
        const row = sheet.addRow([
          p.name || "N/A",
          p.category || "N/A",
          p.stock ?? 0,
          p.minStock ?? 0,
          p.price || 0,
          getStockStatus(p.stock ?? 0, p.minStock ?? 0)
        ]);
        row.eachCell(cell => { cell.border = borderStyle; });
      });
      sheet.columns = [{ width: 25 }, { width: 15 }, { width: 10 }, { width: 12 }, { width: 15 }, { width: 15 }];
    };

    createInventorySheet("All Products", allData);
    createInventorySheet(`Low Stock (${lowStock.length})`, lowStock);
    createInventorySheet(`Out of Stock (${outOfStock.length})`, outOfStock);

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `NexFlow_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    onClose();
  };

  const exportSalesToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const allSales = [...(sales || [])].filter(s => s.status !== 'returned');
    const returnedSales = [...(sales || [])].filter(s => s.status === 'returned');
    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

    const addHeaderRow = (sheet, headers, fgColor = 'FFE8F4FD') => {
      const headerRow = sheet.addRow(headers);
      headerRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.border = borderStyle;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } };
      });
      return headerRow;
    };

    const txSheet = workbook.addWorksheet("All Transactions");
    txSheet.mergeCells("A1:F1");
    const t1 = txSheet.getCell("A1");
    t1.value = "NexFlow Sales Report";
    t1.font = { size: 16, bold: true };
    t1.alignment = { horizontal: "center", vertical: "middle" };
    txSheet.mergeCells("A2:F2");
    txSheet.getCell("A2").value = `Generated: ${new Date().toLocaleDateString("en-PK")}`;
    txSheet.getCell("A2").alignment = { horizontal: "center" };
    for (let i = 1; i <= 6; i++) {
      txSheet.getCell(1, i).border = borderStyle;
      txSheet.getCell(2, i).border = borderStyle;
    }
    addHeaderRow(txSheet, ["Date", "Time", "Invoice ID", "Items", "Total (Rs.)", "Status"]);
    sales.forEach(s => {
      const d = new Date(s.saleDate);
      txSheet.addRow([
        d.toLocaleDateString('en-PK'),
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        String(s._id || s.id || '').slice(-8).toUpperCase(),
        s.items.map(i => `${i.name} x${i.quantity}`).join(', '),
        s.totalAmount,
        s.status?.toUpperCase() || 'PAID'
      ]).eachCell(cell => { cell.border = borderStyle; });
    });
    txSheet.columns = [{ width: 14 }, { width: 10 }, { width: 15 }, { width: 40 }, { width: 15 }, { width: 12 }];

    const sumSheet = workbook.addWorksheet("Summary");
    sumSheet.mergeCells("A1:B1");
    sumSheet.getCell("A1").value = "Business Summary";
    sumSheet.getCell("A1").font = { size: 14, bold: true };
    sumSheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sumSheet.getCell(1, 1).border = borderStyle;
    sumSheet.getCell(1, 2).border = borderStyle;
    const totalRevenue = allSales.reduce((s, x) => s + x.totalAmount, 0);
    const totalReturns = returnedSales.reduce((s, x) => s + x.totalAmount, 0);
    const summaryRows = [["Total Transactions", allSales.length], ["Total Revenue (Rs.)", totalRevenue], ["Total Returns (Rs.)", totalReturns], ["Net Revenue (Rs.)", totalRevenue - totalReturns], ["Returned Transactions", returnedSales.length]];
    summaryRows.forEach(([label, value]) => {
      const row = sumSheet.addRow([label, value]);
      row.getCell(1).font = { bold: true };
      row.eachCell(c => c.border = borderStyle);
    });
    sumSheet.columns = [{ width: 28 }, { width: 18 }];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `NexFlow_Sales_${new Date().toISOString().split('T')[0]}.xlsx`);
    onClose();
  };

  const handleWhatsAppExport = () => {
    const outOfStockItems = (products || []).filter(p => p.stock === 0);
    const lowStockItems = (products || []).filter(p => p.stock > 0 && p.stock <= p.minStock);
    const totalValue = (products || []).reduce((sum, p) => sum + (p.stock * p.price), 0);
    const phone = import.meta.env.VITE_WHATSAPP_NUMBER || "+923013241531";
    const dateStr = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
    let message = `*NexFlow Inventory Summary*\nDate: ${dateStr}\n\n*Overview*\n• Total Products: ${(products || []).length}\n• Inventory Value: Rs. ${totalValue.toLocaleString('en-PK')}\n\n`;
    if (outOfStockItems.length > 0) {
      message += `*Out of Stock (${outOfStockItems.length})*\n`;
      outOfStockItems.forEach(p => { message += `• ${p.name}\n`; });
      message += `\n`;
    }
    if (lowStockItems.length > 0) {
      message += `*Low Stock (${lowStockItems.length})*\n`;
      lowStockItems.forEach(p => { message += `• ${p.name} (${p.stock} left)\n`; });
      message += `\n`;
    }
    message += `Action: Restock items immediately\n\nNexFlow System`;
    const url = `https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-[95%] sm:w-[440px] bg-[var(--color-surface-card)] rounded-xl shadow-sm border border-[var(--color-border-subtle)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col z-10 mx-auto">

        {/* Header Section */}
        <div className="bg-[var(--color-surface-card)] p-6 sm:p-8 text-[var(--color-text-primary)] relative shrink-0 border-b border-[var(--color-border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-[var(--color-surface-base)] hover:bg-[var(--color-surface-base)] rounded-xl transition-all border border-[var(--color-border-subtle)] group/close"
          >
            <X className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors" />
          </button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600 rounded-xl shadow-lg shadow-[var(--color-primary)]/20">
              <Download className="w-5 h-5 text-[var(--color-text-primary)]" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">
                Reports <span className="text-[var(--color-primary)]">Center</span>
              </h2>
              <p className="text-[var(--color-text-muted)] text-[8px] font-bold uppercase tracking-[0.2em] mt-1">
                NexusOS Data Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Action Body */}
        <div className="p-6 sm:p-8 space-y-6 bg-[var(--color-surface-card)]">

          {/* Asset Management Section */}
          <div className="space-y-3">
            <h3 className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Inventory Management</h3>
            <button
              onClick={exportInventoryToExcel}
              className="group w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-primary)] rounded-xl font-bold text-[11px] uppercase tracking-wider shadow-lg shadow-[var(--color-primary)]/10 hover:shadow-[var(--color-primary)]/20 hover:scale-[1.01] active:scale-95 transition-all outline-none"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Inventory Records
            </button>
          </div>

          {/* Fiscal Performance Section */}
          <div className="space-y-3">
            <h3 className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Financial Analysis</h3>
            <button
              onClick={exportSalesToExcel}
              disabled={sales.length === 0}
              className="w-full flex items-center justify-center gap-3 py-4 bg-[var(--color-surface-base)] hover:bg-[var(--color-surface-base)] text-[var(--color-text-primary)] rounded-xl font-bold text-[11px] uppercase tracking-wider border border-[var(--color-border-subtle)] transition-all active:scale-95 disabled:opacity-20 outline-none group"
            >
              <TrendingUp className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-emerald-500 transition-colors" />
              Download Sales Audit
            </button>
          </div>

          {/* WhatsApp Communications */}
          <div className="space-y-3">
            <h3 className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest pl-1">Instant Briefing</h3>
            <button
              onClick={handleWhatsAppExport}
              className="w-full flex items-center justify-between p-4 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-2xl border border-emerald-500/10 transition-all group outline-none"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500 rounded-xl shadow-md text-[var(--color-text-primary)]">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-tight">WhatsApp Summary</p>
                  <p className="text-[8px] font-medium text-emerald-500 uppercase tracking-wider mt-0.5">Live Status Update</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-emerald-500/50 group-hover:text-emerald-500 transition-colors mr-2" />
            </button>
          </div>

        </div>

        {/* Simple Footer Spacer */}
        <div className="h-8 shrink-0 bg-surface-card" />
      </div>
    </div>
  );
}