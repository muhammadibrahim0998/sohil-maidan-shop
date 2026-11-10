import { BaseModel } from './dbHelper.js';

class OrderModel extends BaseModel {
  constructor() {
    super('orders', 'id', ['items']);
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;

    if (!Array.isArray(obj.items)) {
      obj.items = [];
    }

    obj.shippingDetails = {
      fullName: obj.shippingFullName || '',
      phone: obj.shippingPhone || '',
      address: obj.shippingAddress || '',
      city: obj.shippingCity || ''
    };
    obj.totalAmount = Number(obj.totalAmount) || 0;
    return obj;
  }

  async create(orderData) {
    const data = { ...orderData };
    if (data.shippingDetails) {
      data.shippingFullName = data.shippingDetails.fullName || data.shippingFullName || '';
      data.shippingPhone = data.shippingDetails.phone || data.shippingPhone || '';
      data.shippingAddress = data.shippingDetails.address || data.shippingAddress || '';
      data.shippingCity = data.shippingDetails.city || data.shippingCity || '';
    }
    if (!Array.isArray(data.items)) {
      data.items = [];
    }
    return await super.create(data);
  }

  async findByIdAndUpdate(id, updateData, options = {}) {
    const raw = updateData.$set || updateData;
    const data = { ...raw };
    if (data.shippingDetails) {
      data.shippingFullName = data.shippingDetails.fullName || data.shippingFullName || '';
      data.shippingPhone = data.shippingDetails.phone || data.shippingPhone || '';
      data.shippingAddress = data.shippingDetails.address || data.shippingAddress || '';
      data.shippingCity = data.shippingDetails.city || data.shippingCity || '';
    }
    return await super.findByIdAndUpdate(id, data, options);
  }
}

const Order = new OrderModel();
export default Order;

