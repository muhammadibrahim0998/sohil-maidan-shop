import { BaseModel } from './dbHelper.js';

class CashSessionModel extends BaseModel {
  constructor() {
    super('cash_sessions', 'id');
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    obj.openingCash = Number(obj.openingCash) || 0;
    obj.closingCash = Number(obj.closingCash) || 0;
    obj.totalSales = Number(obj.totalSales) || 0;
    obj.totalReturns = Number(obj.totalReturns) || 0;
    obj.expectedCash = Number(obj.expectedCash) || 0;
    obj.actualCash = Number(obj.actualCash) || 0;
    return obj;
  }
}

const CashSession = new CashSessionModel();
export default CashSession;
