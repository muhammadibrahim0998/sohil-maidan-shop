import { BaseModel } from './dbHelper.js';

class ProfitReportModel extends BaseModel {
  constructor() {
    super('profit_reports', 'id');
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    obj.totalSales = Number(obj.totalSales) || 0;
    obj.totalProfit = Number(obj.totalProfit) || 0;
    obj.totalPurchasesCost = Number(obj.totalPurchasesCost) || 0;
    obj.totalExpenses = Number(obj.totalExpenses) || 0;
    obj.totalDamagedLoss = Number(obj.totalDamagedLoss) || 0;
    obj.netProfit = Number(obj.netProfit) || 0;
    return obj;
  }
}

const ProfitReport = new ProfitReportModel();
export default ProfitReport;
