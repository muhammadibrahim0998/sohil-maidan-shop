import { BaseModel } from './dbHelper.js';

class PurchaseCreditModel extends BaseModel {
  constructor() {
    super('purchase_credits', 'id');
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    obj.totalCost = Number(obj.totalCost) || 0;
    obj.paidToDate = Number(obj.paidToDate) || 0;
    obj.pendingDue = Number(obj.pendingDue) || 0;

    let petis = Number(obj.petisPurchased || obj.petiQuantity || 0);
    let trays = Number(obj.trayQuantity || obj.traysCount || 0);
    let eggs = Number(obj.eggQuantity || obj.totalEggsCount || 0);

    const qText = String(obj.quantityText || obj.notes || obj.productName || '');
    if (qText) {
      const pMatch = qText.match(/(\d+(?:\.\d+)?)\s*(?:peti|petis|box|boxes|p\b)/i);
      const tMatch = qText.match(/(\d+(?:\.\d+)?)\s*(?:tray|trays|t\b)/i);
      const eMatch = qText.match(/([\d,]+(?:\.\d+)?)\s*(?:egg|eggs|e\b|stock)/i);
      if (pMatch && !petis) petis = parseFloat(pMatch[1]);
      if (tMatch && !trays) trays = parseFloat(tMatch[1]);
      if (eMatch && !eggs) eggs = parseFloat(eMatch[1].replace(/,/g, ''));
    }

    if (petis > 0 && trays === 0) trays = Math.round(petis * 12);
    if (petis > 0 && eggs === 0) eggs = Math.round(petis * 360);
    if (trays > 0 && eggs === 0) eggs = Math.round(trays * 30);
    if (eggs > 0 && petis === 0) petis = Number((eggs / 360).toFixed(2));
    if (eggs > 0 && trays === 0) trays = Math.round(eggs / 30);

    obj.petisPurchased = petis;
    obj.petiQuantity = petis;
    obj.petisCount = petis;
    obj.trayQuantity = trays;
    obj.traysCount = trays;
    obj.eggQuantity = eggs;
    obj.totalEggsCount = eggs;

    return obj;
  }
}

const PurchaseCredit = new PurchaseCreditModel();
export default PurchaseCredit;
