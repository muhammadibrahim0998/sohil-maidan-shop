import { BaseModel } from './dbHelper.js';

class ExpenseModel extends BaseModel {
  constructor() {
    super('expenses', 'id');
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    obj.amount = Number(obj.amount) || 0;
    return obj;
  }
}

const Expense = new ExpenseModel();
export default Expense;
