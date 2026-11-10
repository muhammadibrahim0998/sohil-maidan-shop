import React, { useState, useEffect } from 'react';
import { X, Printer, Share2, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export default function WalkInBillModal({ bill, shop, onClose, currency = 'RS' }) {
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const [targetPhone, setTargetPhone] = useState(bill?.customerPhone || '');

  useEffect(() => {
    if (bill?.customerPhone) {
      setTargetPhone(bill.customerPhone);
    }
  }, [bill]);

  if (!bill) return null;

  const saleDate = bill.saleDate ? new Date(bill.saleDate).toLocaleString() : new Date().toLocaleString();
  const customerName = bill.customerName || 'Walk-in Customer';
  const customerEmail = bill.customerEmail || bill.email || bill.customerId?.email || '';
  const customerPhone = bill.customerPhone || '';
  const items = bill.items || [];
  const totalAmount = bill.totalAmount || 0;
  const discountAmount = Number(bill.discount) || 0;
  const subtotalAmount = Number(bill.subtotal) || (totalAmount + discountAmount);
  const shopName = shop?.name || 'POS Store';
  const shopAddress = shop?.address || '';
  const shopPhone = shop?.phone || '';

  // Extract clean serial number & formatted invoice number
  const rawSerial = bill.serialNumber || (bill.invoiceNumber ? bill.invoiceNumber.replace(/\D/g, '') : '') || String(bill._id || Date.now()).slice(-6);
  const serialNo = String(rawSerial);
  const invoiceDisplay = bill.invoiceNumber || `INV-${serialNo.padStart(5, '0')}`;

  const getBranchBank = () => {
    if (shop?.bankName || shop?.bankAccountNumber) {
      return {
        bank: shop.bankName || 'Branch Bank',
        accountNo: shop.bankAccountNumber || '—',
        accountTitle: shop.bankAccountTitle || ''
      };
    }
    const name = String(shopName || '').toLowerCase();
    const address = String(shopAddress || '').toLowerCase();
    if (name.includes('peshawar') || name.includes('peshawer') || address.includes('peshawar')) {
      return { bank: 'Meezan Bank (RIZWAN ULLAH)', accountNo: '07190104740373', accountTitle: 'RIZWAN ULLAH' };
    }
    if (name.includes('mardan') || address.includes('mardan')) {
      return { bank: 'Bank Al Habib', accountNo: '2013008100773501', accountTitle: '' };
    }
    if (name.includes('attock') || address.includes('attock')) {
      return { bank: 'UBL (Online POS Software)', accountNo: 'UBL-0109000306243543', accountTitle: 'Online POS Software' };
    }
    return { bank: 'UBL / Meezan', accountNo: 'UBL-0109000306243543', accountTitle: '' };
  };
  const branchBank = getBranchBank();

  // Helper to extract clean name and separate Peti / Tray / Egg badges
  const getItemBreakdownDetails = (item) => {
    if (!item) return { rawName: 'Egg', petis: '0 Peti', trays: '0 Trays', eggs: '0 Eggs', unit: 'peti', qty: 1 };
    let rawName = item.rawProductName || (item.name ? item.name.replace(/\s*\([^)]*\)/g, '').trim() : 'Egg');
    if (!rawName) rawName = 'Egg';

    const qty = Number(item.quantity) || 1;
    const nameLower = (item.name || '').toLowerCase();
    const unit = String(item.unit || item.selectedUnit || '').toLowerCase() || 
      (nameLower.includes('peti') ? 'peti' : nameLower.includes('tray') ? 'tray' : 'egg');

    const tPerPeti = Number(item.traysPerPeti) || 12;
    const ePerTray = Number(item.eggsPerTray) || 30;
    const ePerPeti = tPerPeti * ePerTray;

    let petis = '';
    let trays = '';
    let eggs = '';

    if (unit === 'peti') {
      petis = `${qty} Master Box${qty > 1 ? 'es' : ''} (360)`;
      trays = `${(qty * tPerPeti).toFixed(1).replace(/\.0$/, '')} Inner Pack (12)`;
      eggs = `${Math.round(qty * ePerPeti).toLocaleString()} Piece (1)`;
    } else if (unit === 'tray') {
      petis = `${(qty / tPerPeti).toFixed(2).replace(/\.00$/, '')} Master Box (360)`;
      trays = `${qty} Inner Pack${qty > 1 ? 's' : ''} (12)`;
      eggs = `${Math.round(qty * ePerTray).toLocaleString()} Piece (1)`;
    } else {
      petis = `${(qty / ePerPeti).toFixed(2).replace(/\.00$/, '')} Master Box (360)`;
      trays = `${(qty / ePerTray).toFixed(1).replace(/\.0$/, '')} Inner Pack (12)`;
      eggs = `${qty} Piece${qty > 1 ? 's' : ''} (1)`;
    }

    return { rawName, petis, trays, eggs, unit, qty };
  };

  // ── Helper to build High-End Executive PDF Invoice ──
  const createPDFDocument = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // 1. Top Header Banner (Emerald Gradient)
    doc.setFillColor(21, 128, 61); // Emerald #15803d
    doc.rect(0, 0, 210, 36, 'F');

    // Company Name & Subtitle
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(shopName.toUpperCase(), 14, 16);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIAL SALES INVOICE & TAX BILL RECEIPT', 14, 22);
    if (shopAddress || shopPhone) {
      doc.text(`${shopAddress} • Phone: ${shopPhone || 'N/A'}`, 14, 28);
    }

    // Right Side: Serial Badge
    doc.setFillColor(217, 119, 6); // Amber Gold #d97706
    doc.roundedRect(148, 8, 48, 20, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`SERIAL: #${serialNo}`, 154, 16);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceDisplay, 154, 23);

    // 2. Invoice Details Box
    doc.setFillColor(248, 250, 252); // Slate #f8fafc
    doc.setDrawColor(203, 213, 225); // Slate #cbd5e1
    doc.roundedRect(14, 42, 182, 28, 2, 2, 'FD');

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(8.5);

    // Left Column
    doc.setFont('helvetica', 'bold');
    doc.text('BILLED TO (CUSTOMER):', 18, 49);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10.5);
    doc.text(customerName.toUpperCase(), 18, 55);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    if (customerEmail) {
      doc.text(`Email: ${customerEmail}`, 18, 60);
    }
    let paymentDesc = 'Paid in Cash';
    if (Number(bill.dueAmount) > 0 && (Number(bill.cashPaid) > 0 || Number(bill.bankPaid) > 0)) {
      paymentDesc = `Split: ${Number(bill.bankPaid) > 0 ? 'Bank' : 'Cash'} Paid (${currency} ${(Number(bill.cashPaid) || Number(bill.bankPaid) || 0).toLocaleString()}) + Due (${currency} ${(Number(bill.dueAmount) || 0).toLocaleString()})`;
    } else if (bill.isCredit || bill.paymentMethod === 'CREDIT' || Number(bill.dueAmount) >= totalAmount) {
      paymentDesc = `Credit Sale (Due: ${currency} ${(Number(bill.dueAmount) || totalAmount).toLocaleString()})`;
    } else if (bill.paymentMethod === 'BANK_TRANSFER' || Number(bill.bankPaid) > 0) {
      paymentDesc = 'Bank Transfer (Approved)';
    }
    doc.text(`Payment: ${paymentDesc}`, 18, customerEmail ? 66 : 63);

    // Right Column
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('INVOICE METADATA:', 110, 49);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Date & Time: ${saleDate}`, 110, 55);
    doc.text(`Branch Bank: ${branchBank.bank}`, 110, 61);
    doc.text(`Account No: ${branchBank.accountNo}`, 110, 66);

    // 3. Items Table
    const tableData = items.map((item, index) => {
      const d = getItemBreakdownDetails(item);
      return [
        index + 1,
        `${d.rawName.toUpperCase()}\n[ 📦 ${d.petis}  |  🍱 ${d.trays}  |  🥚 ${d.eggs} ]`,
        item.quantity,
        `${currency} ${(item.price || 0).toLocaleString()}`,
        `${currency} ${((item.quantity || 1) * (item.price || 0)).toLocaleString()}`
      ];
    });

    autoTable(doc, {
      startY: 75,
      head: [['#', 'ITEM DESCRIPTION', 'QTY', `UNIT PRICE (${currency})`, `SUBTOTAL (${currency})`]],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [21, 128, 61],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
        1: { halign: 'left', fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 24, fontStyle: 'bold', textColor: [21, 128, 61] },
        3: { halign: 'right', cellWidth: 38 },
        4: { halign: 'right', cellWidth: 42, fontStyle: 'bold', textColor: [15, 23, 42] }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      styles: {
        fontSize: 9,
        cellPadding: 3.5,
        lineColor: [203, 213, 225],
        lineWidth: 0.2
      }
    });

    const finalY = (doc['lastAutoTable']?.finalY || 130) + 6;

    // 4. Grand Total Bar
    doc.setFillColor(220, 252, 231); // Emerald #dcfce7
    doc.setDrawColor(34, 197, 94); // Green #22c55e
    doc.roundedRect(100, finalY, 96, 16, 2, 2, 'FD');

    doc.setTextColor(21, 128, 61);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('GRAND TOTAL PAID:', 105, finalY + 10.5);

    doc.setFontSize(13);
    doc.text(`${currency} ${totalAmount.toLocaleString()}`, 190, finalY + 11, { align: 'right' });

    // 5. Signatures & Footer
    const footerY = Math.max(finalY + 36, 255);
    doc.setDrawColor(203, 213, 225);
    doc.line(20, footerY, 75, footerY);
    doc.line(135, footerY, 190, footerY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Customer Signature', 47.5, footerY + 5, { align: 'center' });
    doc.text('Authorized Signature & Stamp', 162.5, footerY + 5, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text(`Official Bill Receipt • Generated by ${shopName} • Thank you for your business!`, 105, footerY + 15, { align: 'center' });

    return doc;
  };

  // 1. Download PDF (used internally by WhatsApp share)
  const downloadPDF = () => {
    const doc = createPDFDocument();
    const pdfFileName = `Invoice_${invoiceDisplay}_${customerName.replace(/\s+/g, '_')}.pdf`;
    doc.save(pdfFileName);
    return { doc, pdfFileName };
  };

  // 2. Export / Generate Styled Excel Spreadsheet (.xls / .csv compatible)
  const handleDownloadExcel = () => {
    try {
      const formattedItemsHtml = items.map((item, idx) => {
        const d = getItemBreakdownDetails(item);
        return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="text-align: center; border: 1px solid #94a3b8; padding: 8px 10px; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
          <td style="text-align: left; border: 1px solid #94a3b8; padding: 8px 12px; vertical-align: middle;">
            <div style="font-weight: 900; font-size: 11pt; color: #0f172a; text-transform: uppercase; margin-bottom: 3px;">${d.rawName}</div>
            <div style="font-size: 9pt; font-weight: bold;">
              <span style="color: #b45309;">📦 ${d.petis}</span> &nbsp;•&nbsp;
              <span style="color: #0284c7;">🍱 ${d.trays}</span> &nbsp;•&nbsp;
              <span style="color: #15803d;">🥚 ${d.eggs}</span>
            </div>
          </td>
          <td style="text-align: center; border: 1px solid #94a3b8; padding: 8px 10px; font-weight: 900; color: #15803d; vertical-align: middle;">${item.quantity}</td>
          <td style="text-align: right; border: 1px solid #94a3b8; padding: 8px 12px; font-weight: 600; vertical-align: middle;">${currency} ${(item.price || 0).toLocaleString()}</td>
          <td style="text-align: right; border: 1px solid #94a3b8; padding: 8px 12px; font-weight: 900; color: #0f172a; vertical-align: middle;">${currency} ${((item.quantity || 1) * (item.price || 0)).toLocaleString()}</td>
        </tr>
      `;
      }).join('');

      const excelTemplate = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <!--[if gte mso 9]>
          <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Official Bill Invoice</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body, table, td, th { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; }
            table { border-collapse: collapse; }
            .header-banner { background-color: #166534; color: #ffffff; font-size: 16pt; font-weight: bold; text-align: center; height: 42px; border: 1px solid #14532d; }
            .sub-banner { background-color: #dcfce7; color: #166534; font-size: 10pt; font-weight: bold; text-align: center; height: 26px; border: 1px solid #86efac; }
            .info-label { background-color: #f1f5f9; font-weight: bold; color: #334155; padding: 6px 12px; border: 1px solid #94a3b8; font-size: 10pt; width: 140px; }
            .info-val { background-color: #ffffff; color: #0f172a; padding: 6px 12px; border: 1px solid #94a3b8; font-size: 10pt; font-weight: 600; }
            .col-header { background-color: #15803d; color: #ffffff; font-weight: bold; font-size: 11pt; padding: 8px 10px; border: 1px solid #166534; text-transform: uppercase; text-align: center; }
            .total-row { background-color: #dcfce7; color: #15803d; font-weight: 900; font-size: 13pt; height: 38px; border: 2px solid #22c55e; }
            .footer-note { font-size: 9pt; color: #64748b; font-style: italic; text-align: center; }
          </style>
        </head>
        <body>
          <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%;">
            <tr>
              <td colspan="5" class="header-banner">${shopName.toUpperCase()}</td>
            </tr>
            <tr>
              <td colspan="5" class="sub-banner">OFFICIAL BILL INVOICE &amp; PAYMENT STATEMENT</td>
            </tr>
            <tr style="height: 10px;"><td colspan="5" style="border:none;"></td></tr>
            <tr>
              <td class="info-label">Invoice ID:</td>
              <td class="info-val" style="font-weight: 900; color: #15803d;">${invoiceDisplay}</td>
              <td style="width: 20px; border:none;"></td>
              <td class="info-label">Transaction Date:</td>
              <td class="info-val">${saleDate}</td>
            </tr>
            <tr>
              <td class="info-label">Serial Number:</td>
              <td class="info-val" style="font-weight: 900;">#${serialNo}</td>
              <td style="border:none;"></td>
              <td class="info-label">Payment Status:</td>
              <td class="info-val" style="color: #15803d; font-weight: bold;">${bill.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer (Approved)' : 'Paid in Cash'}</td>
            </tr>
            <tr>
              <td class="info-label">Customer Name:</td>
              <td class="info-val" style="font-weight: bold;">${customerName}</td>
              <td style="border:none;"></td>
              <td class="info-label">Customer Email:</td>
              <td class="info-val" style="font-weight: bold; color:#4338ca;">${customerEmail || 'N/A'}</td>
            </tr>
            <tr>
              <td class="info-label">Customer Phone:</td>
              <td class="info-val" style="mso-number-format:'\\@'; font-weight: bold;">${customerPhone ? `="${customerPhone}"` : 'N/A'}</td>
              <td style="border:none;"></td>
              <td class="info-label">Store / Branch:</td>
              <td class="info-val">${shopName}</td>
            </tr>
            <tr>
              <td class="info-label">Branch Bank:</td>
              <td colspan="4" class="info-val">${branchBank.bank} (${branchBank.accountNo})</td>
            </tr>
            <tr style="height: 14px;"><td colspan="5" style="border:none;"></td></tr>
            <tr style="height: 32px;">
              <th class="col-header" style="width: 50px;">#</th>
              <th class="col-header" style="width: 260px; text-align: left;">Item Description</th>
              <th class="col-header" style="width: 90px;">Quantity</th>
              <th class="col-header" style="width: 140px; text-align: right;">Unit Price (${currency})</th>
              <th class="col-header" style="width: 150px; text-align: right;">Subtotal (${currency})</th>
            </tr>
            ${formattedItemsHtml}
            <tr style="height: 10px;"><td colspan="5" style="border:none;"></td></tr>
            <tr class="total-row">
              <td colspan="3" style="text-align: right; padding-right: 15px; border: 1px solid #86efac;">GRAND TOTAL AMOUNT PAID:</td>
              <td colspan="2" style="text-align: right; padding-right: 12px; color: #15803d; border: 1px solid #86efac;">${currency} ${totalAmount.toLocaleString()}</td>
            </tr>
            <tr style="height: 16px;"><td colspan="5" style="border:none;"></td></tr>
            <tr>
              <td colspan="5" class="footer-note" style="border:none;">Generated via ${shopName} Management System • Verified Official Receipt</td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Bill_${invoiceDisplay}_${customerName.replace(/\s+/g, '_')}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Formatted Excel spreadsheet downloaded successfully!');
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Failed to generate Excel file.');
    }
  };

  // Format clean international phone number for Pakistan (e.g. 03069578493 -> 923069578493)
  const formatCleanPhone = (phone) => {
    let clean = String(phone || '').replace(/\D/g, '');
    if (clean.startsWith('0092')) clean = '92' + clean.slice(4);
    else if (clean.startsWith('0')) clean = '92' + clean.slice(1);
    else if (clean.length === 10 && clean.startsWith('3')) clean = '92' + clean;
    return clean;
  };

  // Build clean comprehensive WhatsApp bill invoice text representation
  const getWhatsAppMessageText = () => {
    let text = `🧾 *OFFICIAL BILL INVOICE - ${shopName.toUpperCase()}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🔢 *Invoice:* ${invoiceDisplay} (Serial: #${serialNo})\n`;
    text += `📅 *Date:* ${saleDate}\n`;
    text += `👤 *Customer:* ${customerName}\n`;
    if (customerEmail) text += `📧 *Email:* ${customerEmail}\n`;
    if (targetPhone || customerPhone) text += `📞 *Phone:* ${targetPhone || customerPhone}\n`;
    text += `🏦 *Branch Bank:* ${branchBank.bank}\n`;
    text += `💳 *Account No:* ${branchBank.accountNo}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📦 *ITEMS PURCHASED:*\n`;
    items.forEach((item, idx) => {
      const d = getItemBreakdownDetails(item);
      text += `${idx + 1}. *${d.rawName.toUpperCase()}*\n   📦 *${d.petis}* | 🍱 *${d.trays}* | 🥚 *${d.eggs}*\n   Qty: ${item.quantity} x ${currency} ${(item.price || 0).toLocaleString()} = *${currency} ${((item.quantity || 1) * (item.price || 0)).toLocaleString()}*\n`;
    });
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💵 *GRAND TOTAL PAID: ${currency} ${totalAmount.toLocaleString()}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📄 *Official A4 PDF Bill Receipt has been issued & saved.*\n`;
    text += `🙏 *Thank you for shopping with ${shopName}!*`;
    return text;
  };

  // 3. WhatsApp: Generate PDF + Open WhatsApp Options
  const handleWhatsAppShare = () => {
    try {
      downloadPDF();
      setShowWhatsAppPrompt(true);
    } catch (err) {
      console.error('WhatsApp PDF download error:', err);
      setShowWhatsAppPrompt(true);
    }
  };

  // Direct Open WhatsApp with Customer & PDF Downloaded + Pre-filled Invoice
  const handleDirectSharePDFFile = () => {
    try {
      downloadPDF();
      const cleanPhone = formatCleanPhone(targetPhone || customerPhone);
      const text = getWhatsAppMessageText();
      const encodedText = encodeURIComponent(text);

      if (cleanPhone) {
        window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`, '_blank');
        toast.success(`PDF downloaded! Opening WhatsApp Web chat with +${cleanPhone}`);
      } else {
        window.open(`https://web.whatsapp.com/send?text=${encodedText}`, '_blank');
        toast.success('PDF downloaded! Opening WhatsApp Web');
      }
      setShowWhatsAppPrompt(false);
    } catch (err) {
      console.error('WhatsApp open error:', err);
      toast.error('Failed to open WhatsApp.');
    }
  };

  // Direct send to entered number via universal wa.me link
  const handleSendToNumber = (phoneToSend) => {
    downloadPDF();
    const cleanPhone = formatCleanPhone(phoneToSend || targetPhone || customerPhone);
    const text = getWhatsAppMessageText();
    const encodedText = encodeURIComponent(text);

    if (cleanPhone) {
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
      window.open(whatsappUrl, '_blank');
      toast.success(`PDF downloaded! Opening WhatsApp chat with +${cleanPhone}`);
    } else {
      window.open(`https://web.whatsapp.com/send?text=${encodedText}`, '_blank');
      toast.success('PDF downloaded! Opening WhatsApp Web');
    }
    setShowWhatsAppPrompt(false);
  };

  // Direct send via web.whatsapp.com directly
  const handleSendViaWhatsAppWeb = (phoneToSend) => {
    downloadPDF();
    const cleanPhone = formatCleanPhone(phoneToSend || targetPhone || customerPhone);
    const text = getWhatsAppMessageText();
    const encodedText = encodeURIComponent(text);

    if (cleanPhone) {
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
      window.open(whatsappUrl, '_blank');
      toast.success(`PDF downloaded! Opening WhatsApp Web with +${cleanPhone}`);
    } else {
      window.open(`https://web.whatsapp.com/send?text=${encodedText}`, '_blank');
      toast.success('PDF downloaded! Opening WhatsApp Web to choose contact');
    }
    setShowWhatsAppPrompt(false);
  };

  // Open general WhatsApp (works with ANY contact / group without error)
  const handleOpenGeneralWhatsApp = () => {
    downloadPDF();
    const text = getWhatsAppMessageText();
    const encodedText = encodeURIComponent(text);
    window.open(`https://web.whatsapp.com/send?text=${encodedText}`, '_blank');
    toast.success('PDF downloaded! Opening WhatsApp Web with bill message.');
    setShowWhatsAppPrompt(false);
  };

  // Copy bill text to clipboard
  const handleCopyBillText = () => {
    const text = getWhatsAppMessageText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success('Bill text copied to clipboard!');
    }
  };

  // 4. Print Clean Bill Receipt
  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      window.print();
      return;
    }

    let totalItemsQty = 0;
    let totalPetis = 0;
    let totalTrays = 0;
    let totalEggs = 0;

    let itemsHtml = items.map((item, idx) => {
      const d = getItemBreakdownDetails(item);
      const qty = Number(item.quantity) || 1;
      totalItemsQty += qty;

      const tPerPeti = Number(item.traysPerPeti) || 12;
      const ePerTray = Number(item.eggsPerTray) || 30;
      const ePerPeti = tPerPeti * ePerTray;
      const unit = String(item.unit || item.selectedUnit || d.unit || '').toLowerCase();

      if (unit === 'peti') {
        totalPetis += qty;
        totalTrays += qty * tPerPeti;
        totalEggs += qty * ePerPeti;
      } else if (unit === 'tray') {
        totalPetis += qty / tPerPeti;
        totalTrays += qty;
        totalEggs += qty * ePerTray;
      } else {
        totalPetis += qty / ePerPeti;
        totalTrays += qty / ePerTray;
        totalEggs += qty;
      }

      return `
      <tr>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:center; vertical-align:middle;">${idx + 1}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; vertical-align:middle;">
          <div style="font-weight:900; font-size:13px; text-transform:uppercase; color:#0f172a; margin-bottom:4px;">${d.rawName}</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; font-size:10px; font-weight:800;">
            <span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:4px; border:1px solid #fde68a;">📦 ${d.petis}</span>
            <span style="background:#e0f2fe; color:#0369a1; padding:2px 7px; border-radius:4px; border:1px solid #bae6fd;">🍱 ${d.trays}</span>
            <span style="background:#dcfce7; color:#15803d; padding:2px 7px; border-radius:4px; border:1px solid #bbf7d0;">🥚 ${d.eggs}</span>
          </div>
        </td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:center; vertical-align:middle; font-weight:900; color:#059669;">${item.quantity}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; vertical-align:middle;">${currency} ${(item.price || 0).toLocaleString()}</td>
        <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; vertical-align:middle; font-weight:900;">${currency} ${((item.quantity || 1) * (item.price || 0)).toLocaleString()}</td>
      </tr>
    `;
    }).join('');

    const displayPetis = (totalPetis % 1 === 0 ? totalPetis : totalPetis.toFixed(2)).toLocaleString('en-PK');
    const displayTrays = (totalTrays % 1 === 0 ? totalTrays : totalTrays.toFixed(1)).toLocaleString('en-PK');
    const displayEggs = Math.round(totalEggs).toLocaleString('en-PK');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill Receipt - #${serialNo} (${customerName})</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #0f172a; background: #ffffff; }
            .header { text-align: center; border-bottom: 3px double #059669; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { margin: 0; color: #047857; text-transform: uppercase; font-size: 22px; font-weight: 900; }
            .header p { margin: 4px 0 0; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
            .meta { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 16px; background: #f8fafc; padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0; }
            .serial-tag { background: #047857; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th { background: #f1f5f9; text-transform: uppercase; font-weight: 900; font-size: 10px; color: #475569; padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; }
            .breakdown-box { margin-top: 16px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; }
            .breakdown-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; margin-top: 8px; }
            .breakdown-card { border-radius: 8px; padding: 8px; }
            .total-bar { margin-top: 16px; padding: 12px 16px; background: #ecfdf5; border: 2px solid #a7f3d0; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
            .total-bar .tot-lbl { font-weight: 900; font-size: 13px; color: #047857; }
            .total-bar .tot-val { font-weight: 900; font-size: 16px; color: #047857; }
            .bank-info { margin-top: 12px; padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 10px; color: #92400e; font-weight: bold; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; color: #64748b; }
            .sign { border-top: 2px solid #cbd5e1; width: 180px; text-align: center; padding-top: 6px; }
            @media print {
              .breakdown-box, .breakdown-card, .total-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${shopName}</h1>
            <p>Official Sales Bill & Tax Receipt</p>
          </div>
          <div class="meta">
            <div>
              <span style="color:#059669; text-transform:uppercase;">Customer:</span> <strong style="font-size:13px;">${customerName}</strong><br/>
              ${customerEmail ? `<span>Email: <strong style="color:#4338ca;">${customerEmail}</strong></span><br/>` : ''}
              ${customerPhone ? `<span>Phone: ${customerPhone}</span><br/>` : ''}
              <span>Payment: ${bill.paymentMethod === 'CREDIT' || bill.dueAmount > 0 || bill.isCredit ? 'Credit (Due Balance)' : (bill.paymentMethod === 'BANK_TRANSFER' || bill.paymentMethod === 'ONLINE' || bill.paymentMethod === 'BANK' ? 'Bank Transfer' : 'Cash Paid')}</span>
            </div>
            <div style="text-align:right;">
              <span class="serial-tag">SERIAL NO: #${serialNo}</span><br/>
              <span style="display:inline-block; margin-top:5px; color:#64748b;">Invoice: ${invoiceDisplay}</span><br/>
              <span style="color:#64748b;">Date: ${saleDate}</span>
            </div>
          </div>

          <div class="bank-info">
            Official Branch Bank Account: <strong>${branchBank.bank} (${branchBank.accountNo})</strong>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align:center;">#</th>
                <th>Item Description</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Unit Price</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9; font-weight:900; border-top:2px solid #0f172a;">
                <td colspan="2" style="padding:8px 10px; border:1px solid #cbd5e1; text-align:right; font-size:11px; text-transform:uppercase; color:#0f172a;">Total Items &amp; Qty:</td>
                <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:center; font-size:12px; color:#059669; font-weight:900;">${totalItemsQty}</td>
                <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:right; font-size:10px; color:#64748b; font-weight:800;">${items.length} Product${items.length > 1 ? 's' : ''}</td>
                <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:right; font-size:12px; color:#047857; font-weight:900;">${currency} ${totalAmount.toLocaleString('en-PK')}</td>
              </tr>
            </tfoot>
          </table>

          ${discountAmount > 0 ? `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 14px; background:#fffbeb; border:1px dashed #f59e0b; border-radius:8px; margin-top:12px; margin-bottom:8px; font-size:12px; font-weight:800; color:#b45309;">
            <span>🏷️ SPECIAL DISCOUNT APPLIED:</span>
            <span>- ${currency} ${discountAmount.toLocaleString('en-PK')}</span>
          </div>
          ` : ''}

          <div class="total-bar">
            <span class="tot-lbl">${discountAmount > 0 ? 'NET FINAL BILL AMOUNT:' : 'GRAND TOTAL AMOUNT PAID:'}</span>
            <span class="tot-val">${currency} ${totalAmount.toLocaleString('en-PK')}</span>
          </div>

          <div class="footer">
            <div class="sign">Customer Signature</div>
            <div class="sign">${shopName} Stamp</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-100 border border-slate-300 rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-900">

        {/* Header (Clean Gray & White Theme) */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-100 via-gray-50 to-slate-100 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl border border-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-wider text-slate-900">Walk-in Sale Bill</h2>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-mono font-black text-xs rounded-md border border-amber-300">
                  #{serialNo}
                </span>
              </div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">{invoiceDisplay} • Completed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-full bg-slate-200/80 hover:bg-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bill Printable Area */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 print:p-0 print:bg-white print:text-black">
          {/* Shop & Customer details */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 space-y-2.5">
            <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="font-black text-sm text-slate-900 uppercase italic">{shopName}</h3>
                {shopAddress && <p className="text-[10.5px] text-slate-500 font-medium">{shopAddress}</p>}
                {shopPhone && <p className="text-[10.5px] text-emerald-700 font-bold">{shopPhone}</p>}
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <span className="text-[10px] font-mono font-bold text-slate-500 mr-2">Invoice: #{serialNo}</span>
                  {Number(bill.dueAmount) > 0 && (Number(bill.cashPaid) > 0 || Number(bill.bankPaid) > 0) ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 border border-amber-300 shadow-sm">
                      ⚡ PARTIAL / CREDIT
                    </span>
                  ) : bill.paymentMethod === 'CREDIT' || Number(bill.dueAmount) >= totalAmount || bill.isCredit ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-800 border border-rose-300 shadow-sm">
                      📋 CREDIT
                    </span>
                  ) : bill.paymentMethod === 'BANK_TRANSFER' || bill.paymentMethod === 'ONLINE' || bill.paymentMethod === 'BANK' || Number(bill.bankPaid) > 0 ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-800 border border-blue-300 shadow-sm">
                      🏦 BANK TRANSFER
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
                      💵 CASH PAID
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-slate-500">{saleDate}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs flex justify-between items-center text-slate-800 font-mono">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Branch Bank ({branchBank.bank}){branchBank.accountTitle ? ` [${branchBank.accountTitle}]` : ''}:</span>
              <span className="font-bold bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-900 shadow-sm">{branchBank.accountNo}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Customer Name</span>
                <span className="font-bold text-slate-900 uppercase">{customerName}</span>
              </div>
              {customerPhone && (
                <div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">WhatsApp / Phone</span>
                  <span className="font-bold text-emerald-700">{customerPhone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Purchased Items List */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Item</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-right">Price</th>
                  <th className="p-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((item, idx) => {
                  const d = getItemBreakdownDetails(item);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <div className="space-y-1.5">
                          <p className="font-black text-slate-900 text-xs tracking-wide uppercase">{d.rawName}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black">
                              <span>📦</span> {d.petis}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-200 text-cyan-800 text-[10px] font-black">
                              <span>🍱</span> {d.trays}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black">
                              <span>🔹</span> {d.eggs}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center align-middle">
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono font-black text-xs">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="p-3 text-right align-middle text-slate-600 font-mono text-xs">
                        {currency} {(item.price || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right align-middle font-mono font-black text-slate-900 text-sm">
                        {currency} {((item.quantity || 1) * (item.price || 0)).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2">
              {discountAmount > 0 && (
                <>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="font-bold uppercase tracking-wider text-[11px]">Subtotal:</span>
                    <span className="font-black text-slate-800">{currency} {subtotalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-amber-700">
                    <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
                      <span>🏷️</span> Discount:
                    </span>
                    <span className="font-black">- {currency} {discountAmount.toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                  {discountAmount > 0 ? 'Net Final Amount' : 'Grand Total Amount'}
                </span>
                <span className="text-xl font-black text-emerald-700">{currency} {totalAmount.toLocaleString()}</span>
              </div>
              {Number(bill.dueAmount) > 0 && (Number(bill.cashPaid) > 0 || Number(bill.bankPaid) > 0) && (
                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200 bg-white p-2 rounded-xl border shadow-sm">
                  <span className="text-slate-600 font-bold uppercase text-[10px]">
                    💵 Paid ({Number(bill.bankPaid) > 0 ? 'Bank' : 'Cash'}): <strong className="text-emerald-700 font-black">{currency} {(Number(bill.cashPaid) || Number(bill.bankPaid) || 0).toLocaleString()}</strong>
                  </span>
                  <span className="text-rose-700 font-bold uppercase text-[10px]">
                    ⚠️ Credit Due: <strong className="text-rose-700 font-black">{currency} {(Number(bill.dueAmount) || 0).toLocaleString()}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions (3 Buttons: Excel, WhatsApp PDF, Print) */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 grid grid-cols-3 gap-2">
          {/* 1. Excel Download */}
          <button
            onClick={handleDownloadExcel}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10.5px] uppercase tracking-wider rounded-xl border border-slate-300 transition-all shadow-sm cursor-pointer active:scale-95"
            title="Export Excel (.csv)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Save Excel
          </button>

          {/* 2. WhatsApp Direct PDF Share */}
          <button
            onClick={handleWhatsAppShare}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#25D366] hover:bg-[#1ebe57] text-white font-black text-[10.5px] uppercase tracking-wider rounded-xl border border-[#1ebe57] transition-all shadow-md cursor-pointer active:scale-95"
            title="Send PDF directly to WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5 text-white" /> WhatsApp
          </button>

          {/* 3. Print Receipt */}
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-[10.5px] uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
            title="Print Clean Bill Receipt"
          >
            <Printer className="w-3.5 h-3.5" /> Print Bill
          </button>
        </div>

        {/* WhatsApp Share Options Prompt Modal */}
        {showWhatsAppPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white border-2 border-emerald-500 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#25D366]/20 border border-[#25D366] flex items-center justify-center text-[#25D366]">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-900">Send PDF Bill on WhatsApp</h3>
                    <p className="text-[10px] text-emerald-700 font-bold">Official Invoice #{serialNo}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWhatsAppPrompt(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black uppercase text-slate-700 tracking-wider block">
                  Customer WhatsApp Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 03069578493"
                    value={targetPhone}
                    onChange={e => setTargetPhone(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleDirectSharePDFFile}
                    className="px-4 py-2.5 bg-[#25D366] hover:bg-[#1ebe57] text-white font-black text-xs uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Send PDF
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                {/* Primary: Send PDF Bill directly */}
                <button
                  type="button"
                  onClick={handleDirectSharePDFFile}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Send PDF Bill</span>
                </button>

                {/* Secondary Actions: Save PDF & Web WhatsApp */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={downloadPDF}
                    className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-emerald-700 hover:text-emerald-800 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>📄 Save PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendViaWhatsAppWeb(targetPhone)}
                    className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>💻 WhatsApp Web</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
