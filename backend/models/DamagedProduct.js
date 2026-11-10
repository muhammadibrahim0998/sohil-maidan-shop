import { BaseModel } from './dbHelper.js';

class DamagedProductModel extends BaseModel {
  constructor() {
    super('damaged_products', 'id');
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    obj.quantity = Number(obj.quantity) || 0;
    obj.petiQuantity = Number(obj.petiQuantity) || 0;
    obj.trayQuantity = Number(obj.trayQuantity) || 0;
    obj.eggQuantity = Number(obj.eggQuantity) || 0;
    obj.deductedEggs = Number(obj.deductedEggs) || 0;
    obj.unitPrice = Number(obj.unitPrice) || 0;
    obj.totalLoss = Number(obj.totalLoss) || 0;

    // Dynamic fallback calculation for totalLoss if missing or 0 on online server
    if (obj.totalLoss <= 0 && obj.unitPrice > 0) {
      const pQ = obj.petiQuantity;
      const tQ = obj.trayQuantity;
      const eQ = obj.eggQuantity;
      const u = String(obj.unitType || 'egg').toLowerCase().trim();
      if (pQ > 0 || tQ > 0 || eQ > 0) {
        if (u === 'peti') {
          obj.totalLoss = Math.round((pQ * obj.unitPrice) + (tQ * (obj.unitPrice / 12)) + (eQ * (obj.unitPrice / 360)));
        } else if (u === 'tray') {
          obj.totalLoss = Math.round((pQ * (obj.unitPrice * 12)) + (tQ * obj.unitPrice) + (eQ * (obj.unitPrice / 30)));
        } else {
          obj.totalLoss = Math.round((pQ * (obj.unitPrice * 360)) + (tQ * (obj.unitPrice * 30)) + (eQ * obj.unitPrice));
        }
      } else {
        const rawQ = obj.quantity > 0 ? obj.quantity : (obj.deductedEggs > 0 ? obj.deductedEggs : 1);
        obj.totalLoss = Math.round(rawQ * obj.unitPrice);
      }
    }
    return obj;
  }
}

const DamagedProduct = new DamagedProductModel();
export default DamagedProduct;

