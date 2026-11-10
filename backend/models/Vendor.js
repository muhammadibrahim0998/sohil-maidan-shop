import { BaseModel } from './dbHelper.js';

class VendorModel extends BaseModel {
  constructor() {
    super('vendors', 'id');
  }
}

const Vendor = new VendorModel();
export default Vendor;
