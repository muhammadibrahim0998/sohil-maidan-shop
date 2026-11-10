import { BaseModel } from './dbHelper.js';
import bcrypt from 'bcryptjs';

class CustomerModel extends BaseModel {
  constructor() {
    super('customers', 'id', ['cart']);
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;

    if (!Array.isArray(obj.cart)) {
      obj.cart = [];
    }

    obj.comparePassword = async function(candidatePassword) {
      if (!this.password || !candidatePassword) return false;
      return await bcrypt.compare(candidatePassword, this.password);
    };

    return obj;
  }

  async create(customerData) {
    const data = { ...customerData };
    if (data.password && !data.password.startsWith('$2')) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    if (!Array.isArray(data.cart)) {
      data.cart = [];
    }
    return await super.create(data);
  }

  async findByIdAndUpdate(id, updateData, options = {}) {
    const raw = updateData.$set || updateData;
    const data = { ...raw };
    if (data.password && !data.password.startsWith('$2')) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return await super.findByIdAndUpdate(id, data, options);
  }
}

const Customer = new CustomerModel();
export default Customer;

