import React, { useRef } from 'react';
import { X, Printer, ShoppingBag, Download } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { getBackendBaseUrl } from '../services/api';

export function ReceiptModal({ isOpen, onClose, sale }) {
  const printRef = useRef(null);
  const { settings } = useSettings();

  if (!isOpen || !sale) return null;

  const currency = settings.currency || 'Rs.';

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${new Date(sale.saleDate).toLocaleDateString()}</title>
          <style>
            @page { margin: 10mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; padding: 10px; max-width: 380px; margin: auto; font-size: 13px; line-height: 1.4; color: #000; background: white; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 12px; margin-bottom: 15px; }
            .shop-name { font-size: 24px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }
            .subtitle { font-size: 11px; color: #000; margin-top: 2px; }
            .meta { margin: 12px 0; font-size: 12px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .text-left { text-align: left; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .font-black { font-weight: 900; }
            .uppercase { text-transform: uppercase; }
            
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { border-bottom: 1px dashed #000; padding: 8px 2px; font-size: 11px; font-weight: bold; }
            td { padding: 8px 2px; font-size: 12px; vertical-align: top; border-bottom: 1px dotted #eee; }
            
            .total-row { font-weight: bold; font-size: 20px; border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; display: flex; justify-content: space-between; width: 100%; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            
            .footer { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px dashed #000; display: flex; flex-direction: column; align-items: center; }
            .footer img { width: 90px; height: 90px; margin-bottom: 12px; border: 1px solid #000; padding: 2px; }
            .footer p { font-size: 11px; }

            @media print { 
              body { padding: 0; width: 100%; } 
              .no-print { display: none; } 
              img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${content}
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleDownload = () => {
    if (!sale.invoiceUrl) return;
    const apiUrl = getBackendBaseUrl();
    window.open(`${apiUrl}${sale.invoiceUrl}`, '_blank');
  };

  const saleDate = new Date(sale.saleDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-[95%] sm:w-[500px] bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-subtle)] shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto scrollbar-hide z-10 mx-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-subtle)] sticky top-0 bg-[var(--color-surface-base)]/80 backdrop-blur-md z-10 rounded-t-[2rem]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--color-primary)] rounded-xl">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-[var(--color-text-primary)] tracking-tight uppercase italic truncate max-w-[200px]">{settings.shopName}</h2>
          </div>
          <button onClick={onClose} className="p-2.5 text-[var(--color-danger)] hover:bg-rose-50 rounded-xl border border-[var(--color-danger)]/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Preview */}
        <div className="p-5 sm:p-7">
          <div ref={printRef} className="bg-white border border-[var(--color-border-subtle)] rounded-[2.5rem] p-8 font-mono text-sm shadow-2xl text-[var(--color-text-primary)]">
            {/* Header */}
            <div className="header text-center border-b-2 border-dashed border-[var(--color-border-subtle)] pb-4 mb-4">
              <div className="shop-name text-3xl font-black tracking-tighter text-[var(--color-text-primary)] uppercase">{settings.shopName}</div>
              <div className="subtitle text-[var(--color-text-muted)] text-xs mt-1">{settings.address || 'Inventory Management System'}</div>
              {settings.phone && <div className="subtitle text-[var(--color-primary)]/80 text-[11px] mt-2 font-black tracking-widest uppercase">Contact: {settings.phone}</div>}
            </div>

            {/* Meta */}
            <div className="meta mb-2 space-y-1.5 text-[var(--color-text-primary)]">
              <div className="flex justify-between items-center h-6">
                <span className="text-[var(--color-text-muted)] text-[10px] uppercase font-black tracking-[0.2em]">Date:</span>
                <span className="font-black text-[11px] uppercase">{saleDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between items-center h-6">
                <span className="text-[var(--color-text-muted)] text-[10px] uppercase font-black tracking-[0.2em]">Time:</span>
                <span className="font-black text-[11px] uppercase">{saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between items-center h-6">
                <span className="text-[var(--color-text-muted)] text-[10px] uppercase font-black tracking-[0.2em]">Cashier:</span>
                <span className="font-black text-[11px] uppercase">{sale.cashierName || "System Admin"}</span>
              </div>
              <div className="flex justify-between items-center h-6">
                <span className="text-[var(--color-text-muted)] text-[10px] uppercase font-black tracking-[0.2em]">Customer:</span>
                <span className="font-black text-[11px] uppercase truncate ml-4 text-right">
                  {sale.customerName || "Walk-in Customer"}
                </span>
              </div>
              <div className="flex justify-between items-center h-6">
                <span className="text-[var(--color-text-muted)] text-[10px] uppercase font-black tracking-[0.2em]">ID:</span>
                <span className="font-black text-[11px] text-[var(--color-primary)]">#{String(sale._id || sale.id || '').slice(-8).toUpperCase() || 'N/A'}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="divider border-t border-dashed border-[var(--color-border-subtle)] my-2"></div>

            {/* Items Table */}
            <table className="w-full text-[var(--color-text-primary)]">
              <thead>
                <tr className="border-b border-dashed border-[var(--color-border-subtle)]">
                  <th className="text-left py-2.5 text-[9px] font-black uppercase text-[var(--color-text-muted)] tracking-widest w-[45%]">Item</th>
                  <th className="text-center py-2.5 text-[9px] font-black uppercase text-[var(--color-text-muted)] tracking-widest w-[15%]">Qty</th>
                  <th className="text-right py-2.5 text-[9px] font-black uppercase text-[var(--color-text-muted)] tracking-widest w-[20%]">Price</th>
                  <th className="text-right py-2.5 text-[9px] font-black uppercase text-[var(--color-text-muted)] tracking-widest w-[20%]">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-dotted border-[var(--color-border-subtle)]">
                    <td className="py-3 text-[11px] font-black text-[var(--color-text-primary)] max-w-[120px] truncate uppercase tracking-tight">{item.name}</td>
                    <td className="py-3 text-center text-[11px] font-black text-[var(--color-text-primary)]">{item.quantity}</td>
                    <td className="py-3 text-right text-[11px] text-[var(--color-text-secondary)]">{currency} {item.price?.toLocaleString('en-PK')}</td>
                    <td className="py-3 text-right text-[12px] font-black text-[var(--color-primary)]">{currency} {item.subtotal?.toLocaleString('en-PK')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Divider */}
            <div className="divider border-t border-dashed border-[var(--color-border-subtle)] my-2"></div>

            {/* Totals */}
            <div className="space-y-1 text-[var(--color-text-primary)]">
              <div className="flex justify-between items-center border-t-2 border-dashed border-[var(--color-border-subtle)] pt-4 mt-2">
                <span className="text-xs font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Grand Total</span>
                <span className="text-2xl font-black text-[var(--color-primary)] tracking-tighter">{currency} {sale.totalAmount?.toLocaleString('en-PK')}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="footer text-center mt-6 pt-5 border-t border-dashed border-[var(--color-border-subtle)] flex flex-col items-center">
              <div className="mb-4 px-2 py-2 bg-white rounded-2xl shadow-2xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `--- ${settings.shopName} ---\n` +
                    `Invoice: #${String(sale._id || sale.id || '').slice(-8).toUpperCase()}\n` +
                    `Customer: ${sale.customerName || 'Walk-in Customer'}\n` +
                    `Date: ${new Date(sale.saleDate).toLocaleString('en-PK')}\n\n` +
                    `ITEMS:\n` +
                    sale.items.map(i => `${i.name}\n${i.quantity} x ${currency} ${i.price} = ${currency} ${i.subtotal}`).join('\n') +
                    `\n\nTOTAL: ${currency} ${sale.totalAmount?.toLocaleString('en-PK')}\n` +
                    (sale.invoiceUrl ? `\nVIEW ONLINE:\n${getBackendBaseUrl()}${sale.invoiceUrl}` : '') +
                    `\n\nThank you for shopping!`
                  )}`}
                  alt="QR Code"
                  className="w-32 h-32"
                />
              </div>
              <p className="text-sm text-[var(--color-text-primary)] font-black uppercase tracking-tight">Thank you for your business!</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-2 uppercase tracking-[0.3em] font-black leading-none">Powered by {settings.shopName}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={handlePrint}
              className="flex-[1.5] flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-primary)] rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl shadow-[var(--color-primary)]/20"
            >
              <Printer className="w-5 h-5 text-[var(--color-text-primary)]/50" />
              Print
            </button>
            {sale.invoiceUrl && (
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-[var(--color-surface-base)] active:scale-95"
              >
                <Download className="w-5 h-5 text-[var(--color-text-muted)]" />
                PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:text-[var(--color-text-primary)] transition-all active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
