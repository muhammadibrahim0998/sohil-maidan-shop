import { BaseModel } from './dbHelper.js';

class EasyPaisaModel extends BaseModel {
  constructor() {
    super('easypaisa', 'id', ['items']);
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    if (!Array.isArray(obj.items)) {
      obj.items = [];
    }
    obj.amount = Number(obj.amount) || 0;
    return obj;
  }
}

const EasyPaisa = new EasyPaisaModel();
export default EasyPaisa;
