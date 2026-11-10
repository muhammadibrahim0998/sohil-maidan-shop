import { BaseModel } from './dbHelper.js';

class SystemUpdateModel extends BaseModel {
  constructor() {
    super('system_updates', 'id', ['items']);
  }
}

const SystemUpdate = new SystemUpdateModel();
export default SystemUpdate;
