import { BaseModel } from './dbHelper.js';

class CustomerPaymentLedgerModel extends BaseModel {
  constructor() {
    super('customer_payment_ledger', 'id', ['items']);
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    if (!Array.isArray(obj.items)) {
      if (typeof obj.items === 'string' && obj.items.trim()) {
        try {
          obj.items = JSON.parse(obj.items);
          if (typeof obj.items === 'string') obj.items = JSON.parse(obj.items);
        } catch { obj.items = []; }
      } else {
        obj.items = [];
      }
    }
    if (!Array.isArray(obj.items)) obj.items = [];
    obj.totalAmount = Number(obj.totalAmount) || 0;
    obj.cashPaid = Number(obj.cashPaid) || 0;
    obj.bankPaid = Number(obj.bankPaid) || 0;
    obj.dueAmount = Number(obj.dueAmount) || 0;
    obj.petisBought = Number(obj.petisBought) || 0;
    obj.eggsBought = Number(obj.eggsBought) || 0;
    return obj;
  }
}

const CustomerPaymentLedger = new CustomerPaymentLedgerModel();
export default CustomerPaymentLedger;
