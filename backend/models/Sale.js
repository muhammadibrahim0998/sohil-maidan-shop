import { BaseModel } from './dbHelper.js';

class SaleModel extends BaseModel {
  constructor() {
    super('sales', 'id', ['items']);
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;

    if (!Array.isArray(obj.items)) {
      if (typeof obj.items === 'string' && obj.items.trim()) {
        try {
          obj.items = JSON.parse(obj.items);
          if (typeof obj.items === 'string') {
            obj.items = JSON.parse(obj.items);
          }
        } catch {
          obj.items = [];
        }
      } else {
        obj.items = [];
      }
    }
    if (!Array.isArray(obj.items)) {
      obj.items = [];
    }

    obj.totalAmount = Number(obj.totalAmount) || 0;
    obj.totalProfit = Number(obj.totalProfit) || 0;
    obj.cashPaid = Number(obj.cashPaid) || 0;
    obj.bankPaid = Number(obj.bankPaid) || 0;
    obj.dueAmount = Number(obj.dueAmount) || 0;
    return obj;
  }

  async create(saleData) {
    const data = { ...saleData };
    if (!Array.isArray(data.items)) {
      data.items = [];
    }
    return await super.create(data);
  }

  async findByIdAndUpdate(id, updateData, options = {}) {
    const raw = updateData.$set || updateData;
    const data = { ...raw };
    return await super.findByIdAndUpdate(id, data, options);
  }
}

const Sale = new SaleModel();
export default Sale;

