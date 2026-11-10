import { BaseModel } from './dbHelper.js';

class CustomerCreditModel extends BaseModel {
  constructor() {
    super('customer_credits', 'id');
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    obj.totalAmount = Number(obj.totalAmount) || 0;
    obj.paidAmount = Number(obj.paidAmount) || 0;
    obj.dueAmount = Number(obj.dueAmount) || 0;
    return obj;
  }
}

const CustomerCredit = new CustomerCreditModel();
export default CustomerCredit;
