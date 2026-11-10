import { BaseModel } from './dbHelper.js';

class FuelExpenseModel extends BaseModel {
  constructor() {
    super('fuel_expenses', 'id');
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    obj.liters = Number(obj.liters) || 0;
    obj.ratePerLiter = Number(obj.ratePerLiter) || 0;
    obj.totalAmount = Number(obj.totalAmount) || 0;
    obj.paidAmount = Number(obj.paidAmount) || 0;
    obj.dueAmount = Number(obj.dueAmount) || 0;
    return obj;
  }
}

const FuelExpense = new FuelExpenseModel();
export default FuelExpense;
