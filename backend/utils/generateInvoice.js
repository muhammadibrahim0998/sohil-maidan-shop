import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateInvoice = async (sale, filePath, settings = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 📐 DYNAMIC HEIGHT
      const baseHeight = 500; 
      const dynamicHeight = baseHeight + (sale.items.length * 35);

      const doc = new PDFDocument({ 
        size: [226, dynamicHeight],
        margins: { top: 20, left: 15, right: 15, bottom: 20 },
        bufferPages: true 
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const bold = "Helvetica-Bold";
      const normal = "Helvetica";
      const shopName = settings.shopName || "COSMETICS SHOP";
      const shopAddress = settings.address || "Inventory Management System";
      const shopPhone = settings.phone ? `Contact: ${settings.phone}` : "Contact: +923014455631";
      const currency = settings.currency || "PKR";

      const drawDashLine = () => {
        doc.moveDown(0.5);
        doc.strokeColor("#cccccc").lineWidth(0.5).dash(2, { space: 2 })
           .moveTo(15, doc.y).lineTo(211, doc.y).stroke().undash();
        doc.moveDown(0.8);
      };

      // ======================
      // 🏪 HEADER
      // ======================
      doc.font(bold).fontSize(16).text(shopName.toUpperCase(), { align: "center" });
      doc.font(normal).fontSize(8).fillColor("#777777").text(shopAddress, { align: "center" });
      doc.font(bold).fillColor("#2563eb").fontSize(8).text(shopPhone, { align: "center" });
      
      drawDashLine();

      // ======================
      // 📊 META INFO
      // ======================
      const drawMetaRow = (label, value, color = "#222222") => {
        const y = doc.y;
        doc.font(bold).fontSize(7).fillColor("#999999").text(label.toUpperCase() + ":", 15, y);
        doc.font(bold).fontSize(8).fillColor(color).text(value.toUpperCase(), 15, y, { align: "right" });
        doc.moveDown(0.5);
      };

      const dateObj = new Date(sale.saleDate);
      drawMetaRow("Date", dateObj.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }));
      drawMetaRow("Time", dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      drawMetaRow("Cashier", sale.cashierName || "System Admin");
      drawMetaRow("Customer", sale.customerName || "Walk-in Customer");
      drawMetaRow("ID", `#${sale._id.toString().slice(-8).toUpperCase()}`, "#2563eb");

      drawDashLine();

      // ======================
      // 📦 ITEMS TABLE
      // ======================
      doc.font(bold).fontSize(7).fillColor("#999999");
      const tableHeaderY = doc.y;
      doc.text("ITEM", 15, tableHeaderY);
      doc.text("QTY", 100, tableHeaderY, { width: 25, align: "center" });
      doc.text("PRICE", 130, tableHeaderY, { width: 40, align: "right" });
      doc.text("TOTAL", 170, tableHeaderY, { width: 41, align: "right" });
      
      doc.moveDown(0.5);
      doc.strokeColor("#eeeeee").lineWidth(0.5).moveTo(15, doc.y).lineTo(211, doc.y).stroke();
      doc.moveDown(0.5);

      sale.items.forEach(item => {
        const rowY = doc.y;
        doc.font(bold).fontSize(8).fillColor("#222222").text(item.name.toUpperCase(), 15, rowY, { width: 80, height: 10, ellipsis: true });
        doc.font(normal).fontSize(8).text(item.quantity.toString(), 100, rowY, { width: 25, align: "center" });
        doc.fontSize(7).fillColor("#777777").text(`${item.price.toLocaleString()}`, 130, rowY, { width: 40, align: "right" });
        doc.font(bold).fontSize(8).fillColor("#2563eb").text(`${item.subtotal.toLocaleString()}`, 170, rowY, { width: 41, align: "right" });
        
        doc.moveDown(0.5);
        doc.strokeColor("#f0f0f0").lineWidth(0.5).dash(1, { space: 1 }).moveTo(15, doc.y).lineTo(211, doc.y).stroke().undash();
      });

      drawDashLine();

      // ======================
      // 💰 TOTAL SECTION
      // ======================
      const totalY = doc.y;
      doc.font(bold).fontSize(10).fillColor("#999999").text("GRAND TOTAL", 15, totalY + 2);
      doc.font(bold).fontSize(16).fillColor("#2563eb").text(`${currency} ${sale.totalAmount.toLocaleString()}`, 15, totalY, { align: "right" });
      
      doc.moveDown(0.5);
      drawDashLine();

      // ==========================
      // 📱 QR CODE
      // ==========================
      try {
        const qrContent = `Shop: ${shopName}\nID: #${sale._id.toString().slice(-8).toUpperCase()}\nTotal: ${currency} ${sale.totalAmount}`;
        const qrData = await QRCode.toDataURL(qrContent, { margin: 1 });
        // Center the QR code
        const qrSize = 80;
        const qrX = (226 - qrSize) / 2;
        doc.image(qrData, qrX, doc.y, { width: qrSize });
        doc.moveDown(0.5); 
      } catch (qrErr) {
        console.error("QR Generation failed:", qrErr);
      }

      // ==========================
      // 📝 FOOTER TEXT & BANK DETAILS
      // ==========================
      let bankAcc = "UBL: UBL-0109000306243543";
      if (settings?.bankName || settings?.bankAccountNumber) {
        bankAcc = `${settings.bankName || 'Bank'}: ${settings.bankAccountNumber || '—'}${settings.bankAccountTitle ? ` (Title: ${settings.bankAccountTitle})` : ''}`;
      } else {
        const sName = (shopName || '').toLowerCase();
        if (sName.includes('peshawar') || sName.includes('peshawer')) bankAcc = "Meezan Bank: 07190104740373 (Title: RIZWAN ULLAH)";
        else if (sName.includes('mardan')) bankAcc = "Bank Al Habib: 2013008100773501";
        else if (sName.includes('attock')) bankAcc = "UBL: UBL-0109000306243543 (Title: Online POS Software)";
      }

      doc.moveDown(4.5);
      doc.font(bold).fontSize(8).fillColor("#2563eb").text(`BRANCH BANK: ${bankAcc}`, { align: "center" });
      doc.font(bold).fontSize(10).fillColor("#222222").text("THANK YOU FOR YOUR BUSINESS!", { align: "center" });
      doc.font(normal).fontSize(7).fillColor("#999999").text(`POWERED BY ${shopName.toUpperCase()}`, { align: "center" });

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', (err) => reject(err));

    } catch (error) {
      reject(error);
    }
  });
};