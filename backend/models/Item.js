import { BaseModel } from './dbHelper.js';

class ItemModel extends BaseModel {
  constructor() {
    super('items', 'id', ['images']);
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;

    if (!Array.isArray(obj.images)) {
      obj.images = obj.images ? [obj.images] : [];
    }

    // Numbers conversion
    obj.price = Number(obj.price) || 0;
    obj.costPrice = Number(obj.costPrice) || 0;
    obj.stock = Number(obj.stock) || 0;
    obj.minStock = Number(obj.minStock) || 0;
    obj.petiQuantity = Number(obj.petiQuantity) || 0;
    obj.trayQuantity = Number(obj.trayQuantity) || 0;
    obj.eggQuantity = Number(obj.eggQuantity) || 0;
    obj.totalPurchaseCost = Number(obj.totalPurchaseCost) || 0;
    obj.amountPaidToSupplier = Number(obj.amountPaidToSupplier) || 0;
    obj.cashPaidToSupplier = Number(obj.cashPaidToSupplier) || 0;
    obj.bankPaidToSupplier = Number(obj.bankPaidToSupplier) || 0;
    obj.dueAmountToSupplier = Number(obj.dueAmountToSupplier) || 0;

    return obj;
  }
}

const Item = new ItemModel();

// Dynamic Branch Scoping Helper for complete backward compatibility
export const getBranchItemModel = (shopId) => {
  return Item;
};

export const syncBranchProducts = async (shopId) => {
  // Pure MySQL maintains relational shopId scoping natively without redundant collection duplication
  return true;
};

export default Item;
