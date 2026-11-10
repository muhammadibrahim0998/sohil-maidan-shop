import { BaseModel } from './dbHelper.js';

class ShopModel extends BaseModel {
  constructor() {
    super('shops', 'id', ['banksJson', 'allowedPages']);
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;

    // Provide nested ownerDetails for backward compatibility with frontend
    obj.ownerDetails = {
      fullName: obj.ownerFullName || '',
      email: obj.ownerEmail || '',
      phone: obj.ownerPhone || ''
    };

    // Parse banks array
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

    let pages = [];
    if (Array.isArray(obj.allowedPages)) {
      pages = obj.allowedPages;
    } else if (typeof obj.allowedPages === 'string') {
      try {
        pages = JSON.parse(obj.allowedPages);
      } catch {
        pages = [];
      }
    }
    obj.allowedPages = pages;

    return obj;
  }

  async create(shopData) {
    const data = { ...shopData };
    if (data.ownerDetails) {
      data.ownerFullName = data.ownerDetails.fullName || data.ownerFullName || '';
      data.ownerEmail = data.ownerDetails.email || data.ownerEmail || '';
      data.ownerPhone = data.ownerDetails.phone || data.ownerPhone || '';
      delete data.ownerDetails;
    }
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
    if (data.ownerDetails) {
      data.ownerFullName = data.ownerDetails.fullName || data.ownerFullName || '';
      data.ownerEmail = data.ownerDetails.email || data.ownerEmail || '';
      data.ownerPhone = data.ownerDetails.phone || data.ownerPhone || '';
      delete data.ownerDetails;
    }
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
      } else {
        data.bankName = '';
        data.bankAccountNumber = '';
        data.bankAccountTitle = '';
        data.bankName2 = null;
        data.bankAccountNumber2 = null;
        data.bankAccountTitle2 = null;
        data.bankName3 = null;
        data.bankAccountNumber3 = null;
        data.bankAccountTitle3 = null;
      }
      delete data.banks;
    }
    return super.findByIdAndUpdate(id, data, options);
  }

}

const Shop = new ShopModel();
export default Shop;

