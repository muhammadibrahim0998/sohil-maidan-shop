import { BaseModel } from './dbHelper.js';
import bcrypt from 'bcryptjs';

class UserModel extends BaseModel {
  constructor() {
    super('users', 'id');
  }

  _parseRow(row) {
    const obj = super._parseRow(row);
    if (!obj) return null;

    obj.comparePassword = async function(candidatePassword) {
      if (!this.password || !candidatePassword) return false;
      return await bcrypt.compare(candidatePassword, this.password);
    };

    return obj;
  }

  async create(userData) {
    const data = { ...userData };
    if (data.password && !data.password.startsWith('$2')) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return super.create(data);
  }

  async findByIdAndUpdate(id, updateData, options = {}) {
    const raw = updateData.$set || updateData;
    const data = { ...raw };
    if (data.password && !data.password.startsWith('$2')) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return super.findByIdAndUpdate(id, data, options);
  }
}

const User = new UserModel();
export default User;
