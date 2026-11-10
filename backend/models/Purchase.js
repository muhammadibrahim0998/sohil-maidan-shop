import { BaseModel } from './dbHelper.js';

class PurchaseModel extends BaseModel {
  constructor() {
    super('purchases', 'id');
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    obj.buyCost = Number(obj.buyCost) || 0;
    obj.totalCost = Number(obj.totalCost) || 0;
    obj.amountPaid = Number(obj.amountPaid) || 0;
    obj.dueAmount = Number(obj.dueAmount) || 0;
    obj.petiQuantity = Number(obj.petiQuantity) || 0;
    obj.trayQuantity = Number(obj.trayQuantity) || 0;
    obj.eggQuantity = Number(obj.eggQuantity) || 0;
    return obj;
  }
}

const Purchase = new PurchaseModel();
export default Purchase;
