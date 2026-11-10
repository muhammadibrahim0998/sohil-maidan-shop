import { BaseModel } from './dbHelper.js';

class SettingsModel extends BaseModel {
  constructor() {
    super('settings', 'id', ['banksJson']);
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;
    obj.taxRate = Number(obj.taxRate) || 0;

    let banks = [];
    if (Array.isArray(obj.banksJson)) {
      banks = obj.banksJson;
    } else if (typeof obj.banksJson === 'string') {
      try {
        banks = JSON.parse(obj.banksJson);
      } catch {
        banks = [];
      }
    }

    if ((!banks || banks.length === 0) && (obj.bankName || obj.bankAccountNumber)) {
      banks = [{
        bankName: obj.bankName || '',
        bankAccountNumber: obj.bankAccountNumber || '',
        bankAccountTitle: obj.bankAccountTitle || ''
      }];
    }

    obj.banks = banks;
    obj.banksJson = banks;

    return obj;
  }

  async create(settingsData) {
    const data = { ...settingsData };
    if (data.banks !== undefined) {
      data.banksJson = Array.isArray(data.banks) ? data.banks : [];
      if (data.banksJson.length > 0) {
        data.bankName = data.banksJson.map(b => b.bankName).filter(Boolean).join(' | ');
        data.bankAccountNumber = data.banksJson.map(b => b.bankAccountNumber).filter(Boolean).join(' | ');
        data.bankAccountTitle = data.banksJson.map(b => b.bankAccountTitle).filter(Boolean).join(' | ');
        data.bankName2 = data.banksJson[1]?.bankName || null;
        data.bankAccountNumber2 = data.banksJson[1]?.bankAccountNumber || null;
        data.bankAccountTitle2 = data.banksJson[1]?.bankAccountTitle || null;
        data.bankName3 = data.banksJson[2]?.bankName || null;
        data.bankAccountNumber3 = data.banksJson[2]?.bankAccountNumber || null;
        data.bankAccountTitle3 = data.banksJson[2]?.bankAccountTitle || null;
      }
      delete data.banks;
    }
    return super.create(data);
  }

  async findByIdAndUpdate(id, updateData, options = {}) {
    const raw = updateData.$set || updateData;
    const data = { ...raw };
    if (data.banks !== undefined) {
      data.banksJson = Array.isArray(data.banks) ? data.banks : [];
      if (data.banksJson.length > 0) {
        data.bankName = data.banksJson.map(b => b.bankName).filter(Boolean).join(' | ');
        data.bankAccountNumber = data.banksJson.map(b => b.bankAccountNumber).filter(Boolean).join(' | ');
        data.bankAccountTitle = data.banksJson.map(b => b.bankAccountTitle).filter(Boolean).join(' | ');
        data.bankName2 = data.banksJson[1]?.bankName || null;
        data.bankAccountNumber2 = data.banksJson[1]?.bankAccountNumber || null;
        data.bankAccountTitle2 = data.banksJson[1]?.bankAccountTitle || null;
        data.bankName3 = data.banksJson[2]?.bankName || null;
        data.bankAccountNumber3 = data.banksJson[2]?.bankAccountNumber || null;
        data.bankAccountTitle3 = data.banksJson[2]?.bankAccountTitle || null;
      }
      delete data.banks;
    }
    return super.findByIdAndUpdate(id, data, options);
  }
}

const Settings = new SettingsModel();
export default Settings;


