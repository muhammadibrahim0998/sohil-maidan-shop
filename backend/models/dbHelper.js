import pool from '../config/mysql.js';

// Global cache for table columns to prevent MySQL unknown column errors
const tableColumnsCache = {};

async function getTableColumns(tableName) {
  if (tableColumnsCache[tableName]) {
    return tableColumnsCache[tableName];
  }
  try {
    const [rows] = await pool.query(`DESCRIBE \`${tableName}\``);
    const cols = new Set(rows.map(r => r.Field));

    // Auto-ensure required columns on sales and ledger tables
    if (tableName.includes('sales') || tableName.includes('customer_payment_ledger')) {
      if (!cols.has('items')) {
        try {
          await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`items\` LONGTEXT NULL`);
          cols.add('items');
        } catch (_) {}
      }
      if (!cols.has('itemsDescription')) {
        try {
          await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`itemsDescription\` TEXT NULL`);
          cols.add('itemsDescription');
        } catch (_) {}
      }
      if (!cols.has('petisBought')) {
        try {
          await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`petisBought\` DECIMAL(10,2) DEFAULT 0.00`);
          cols.add('petisBought');
        } catch (_) {}
      }
      if (!cols.has('eggsBought')) {
        try {
          await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`eggsBought\` INT DEFAULT 0`);
          cols.add('eggsBought');
        } catch (_) {}
      }
      if (!cols.has('category')) {
        try {
          await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`category\` VARCHAR(100) DEFAULT 'Eggs'`);
          cols.add('category');
        } catch (_) {}
      }
    }

    tableColumnsCache[tableName] = cols;
    return cols;
  } catch {
    return null;
  }
}

const BRANCH_ENTITIES = new Set([
  'items',
  'sales',
  'purchases',
  'purchase_credits',
  'customers',
  'customer_credits',
  'expenses',
  'damaged_products',
  'cash_sessions',
  'orders',
  'easypaisa',
  'profit_reports',
  'vendors',
  'fuel_expenses',
  'customer_payment_ledger',
  'vendor_payment_ledger'
]);

const rawBranchPrefixes = {
  1: 'maidan_branch'
};

export const BRANCH_TABLE_PREFIXES = new Proxy(rawBranchPrefixes, {
  get(target, prop) {
    if (prop in target) return target[prop];
    const num = Number(prop);
    if (!isNaN(num) && num in target) return target[num];
    if (typeof prop === 'string' || typeof prop === 'number') {
      const s = String(prop).toLowerCase();
      if (s.includes('maidan')) return 'maidan_branch';
      if (s.includes('mardan')) return 'maidan_branch';
      if (s.includes('attock')) return 'maidan_branch';
      if (s.includes('peshawar') || s.includes('peshware')) return 'maidan_branch';
    }
    if (!target._isRefreshing) {
      target._isRefreshing = true;
      refreshBranchPrefixes().finally(() => { target._isRefreshing = false; });
    }
    return target[prop] || 'maidan_branch';
  }
});

export const ALL_BRANCH_PREFIXES = ['maidan_branch'];

export const refreshBranchPrefixes = async () => {
  try {
    const [shops] = await pool.query('SELECT id, name FROM shops');
    for (const s of shops) {
      const name = (s.name || '').toLowerCase();
      let pfx = 'maidan_branch';
      if (name.includes('maidan')) {
        pfx = 'maidan_branch';
      }
      rawBranchPrefixes[s.id] = pfx;
      rawBranchPrefixes[String(s.id)] = pfx;
      rawBranchPrefixes[Number(s.id)] = pfx;
    }
  } catch (_) {}
};

// Initial background sync from DB
refreshBranchPrefixes();

/**
 * Base Model Helper for MySQL
 * Provides query syntax (find, findOne, findById, create, update, delete)
 * with native branch folder table routing (peshawar_branch__*, mardan_branch__*, attock_branch__*).
 */
export class BaseModel {
  constructor(tableName, primaryKey = 'id', jsonFields = []) {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.jsonFields = jsonFields;
    this.isBranchEntity = BRANCH_ENTITIES.has(tableName);
  }

  // Get table SQL source based on query shopId
  _getSourceSql(query = {}) {
    if (!this.isBranchEntity) {
      return `\`${this.tableName}\``;
    }

    const shopId = query.shopId ? Number(query.shopId) : null;
    if (shopId && BRANCH_TABLE_PREFIXES[shopId]) {
      return `\`${BRANCH_TABLE_PREFIXES[shopId]}__${this.tableName}\``;
    }

    // Combine all 3 branches when shopId is not specified
    const unionParts = ALL_BRANCH_PREFIXES.map(p => `SELECT * FROM \`${p}__${this.tableName}\``);
    return `(${unionParts.join(' UNION ALL ')}) AS \`${this.tableName}\``;
  }

  // Parse row from MySQL into JS object
  _parseRow(row) {
    if (!row) return null;
    const obj = { ...row };
    
    // Provide both id and _id for seamless frontend compatibility
    if (obj[this.primaryKey] !== undefined) {
      obj._id = obj[this.primaryKey];
      obj.id = obj[this.primaryKey];
    }

    // Parse JSON fields
    for (const field of this.jsonFields) {
      if (typeof obj[field] === 'string') {
        try {
          obj[field] = JSON.parse(obj[field]);
        } catch {
          obj[field] = field === 'allowedPages' ? null : [];
        }
      } else if (!obj[field]) {
        obj[field] = field === 'allowedPages' ? null : [];
      }
    }

    // Convert booleans
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'number' && (key.startsWith('is') || key.endsWith('Enabled') || key === 'isActive')) {
        obj[key] = Boolean(obj[key]);
      }
    }

    obj.toObject = () => ({ ...obj });
    obj.toJSON = () => ({ ...obj });
    obj.save = async () => {
      await this.findByIdAndUpdate(obj[this.primaryKey], obj);
      return obj;
    };
    obj.deleteOne = async () => {
      return await this.findByIdAndDelete(obj[this.primaryKey]);
    };
    obj.remove = async () => {
      return await this.findByIdAndDelete(obj[this.primaryKey]);
    };
    return obj;
  }

  // Build WHERE clause from query object
  _buildWhere(query = {}) {
    if (!query || typeof query !== 'object') return { whereClause: '', values: [] };
    
    const conditions = [];
    const values = [];

    // Handle $or
    if (query.$or && Array.isArray(query.$or) && query.$or.length > 0) {
      const orClauses = [];
      for (const orBranch of query.$or) {
        const { whereClause: branchWhere, values: branchVals } = this._buildWhere(orBranch);
        if (branchWhere) {
          orClauses.push(branchWhere.replace(/^WHERE\s+/i, ''));
          values.push(...branchVals);
        }
      }
      if (orClauses.length > 0) {
        conditions.push(`(${orClauses.join(' OR ')})`);
      }
    }

    for (const [key, val] of Object.entries(query)) {
      if (key === '$or' || val === undefined) continue;

      let col = key === '_id' ? this.primaryKey : key;

      if (val === null) {
        conditions.push(`\`${col}\` IS NULL`);
      } else if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        if (val.$in && Array.isArray(val.$in)) {
          if (val.$in.length === 0) {
            conditions.push('1=0');
          } else {
            const placeholders = val.$in.map(() => '?').join(', ');
            conditions.push(`\`${col}\` IN (${placeholders})`);
            values.push(...val.$in);
          }
        } else if (val.$gte !== undefined && val.$lte !== undefined) {
          conditions.push(`\`${col}\` >= ? AND \`${col}\` <= ?`);
          values.push(val.$gte, val.$lte);
        } else if (val.$gte !== undefined) {
          conditions.push(`\`${col}\` >= ?`);
          values.push(val.$gte);
        } else if (val.$lte !== undefined) {
          conditions.push(`\`${col}\` <= ?`);
          values.push(val.$lte);
        } else if (val.$gt !== undefined) {
          conditions.push(`\`${col}\` > ?`);
          values.push(val.$gt);
        } else if (val.$lt !== undefined) {
          conditions.push(`\`${col}\` < ?`);
          values.push(val.$lt);
        } else if (val.$ne !== undefined) {
          conditions.push(`\`${col}\` != ?`);
          values.push(val.$ne);
        } else if (val.$regex) {
          conditions.push(`\`${col}\` LIKE ?`);
          values.push(`%${val.$regex}%`);
        }
      } else {
        conditions.push(`\`${col}\` = ?`);
        values.push(val);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, values };
  }

  // Find multiple records
  find(query = {}) {
    const sourceSql = this._getSourceSql(query);
    const { whereClause, values } = this._buildWhere(query);
    
    const queryObj = {
      _sort: 'ORDER BY `createdAt` DESC',
      _limit: '',
      _select: '*',
      sort(s) {
        if (typeof s === 'string') {
          const parts = s.split(' ');
          const sortCols = parts.map(p => {
            if (p.startsWith('-')) return `\`${p.substring(1)}\` DESC`;
            return `\`${p}\` ASC`;
          });
          this._sort = `ORDER BY ${sortCols.join(', ')}`;
        } else if (typeof s === 'object') {
          const sortCols = Object.entries(s).map(([k, v]) => `\`${k === '_id' ? 'id' : k}\` ${v === -1 || v === 'desc' ? 'DESC' : 'ASC'}`);
          if (sortCols.length > 0) this._sort = `ORDER BY ${sortCols.join(', ')}`;
        }
        return this;
      },
      select(sel) {
        if (typeof sel === 'string') {
          this._select = sel.split(' ').map(c => c.startsWith('-') ? '' : `\`${c === '_id' ? 'id' : c}\``).filter(Boolean).join(', ') || '*';
        }
        return this;
      },
      limit(n) {
        if (n) this._limit = `LIMIT ${Number(n)}`;
        return this;
      },
      skip(n) {
        return this;
      },
      lean() {
        return this;
      },
      populate() {
        return this;
      },
      then: (resolve, reject) => {
        const sql = `SELECT * FROM ${sourceSql} ${whereClause} ${queryObj._sort} ${queryObj._limit}`;
        pool.query(sql, values)
          .then(([rows]) => resolve(rows.map(r => this._parseRow(r))))
          .catch(async (err) => {
            if (err.code === 'ER_NO_SUCH_TABLE') {
              try {
                const fallbackSql = `SELECT * FROM \`${this.tableName}\` ${whereClause} ${queryObj._sort} ${queryObj._limit}`;
                const [rows] = await pool.query(fallbackSql, values);
                return resolve(rows.map(r => this._parseRow(r)));
              } catch (_) {
                return resolve([]);
              }
            }
            reject(err);
          });
      },
      catch: (reject) => {
        const sql = `SELECT * FROM ${sourceSql} ${whereClause} ${queryObj._sort} ${queryObj._limit}`;
        return pool.query(sql, values).catch(reject);
      }
    };

    return queryObj;
  }

  // Find one record
  findOne(query = {}) {
    const sourceSql = this._getSourceSql(query);
    const { whereClause, values } = this._buildWhere(query);
    const queryObj = {
      _sort: '',
      sort(s) {
        if (typeof s === 'string') {
          const parts = s.split(' ');
          const sortCols = parts.map(p => p.startsWith('-') ? `\`${p.substring(1)}\` DESC` : `\`${p}\` ASC`);
          this._sort = `ORDER BY ${sortCols.join(', ')}`;
        } else if (typeof s === 'object') {
          const sortCols = Object.entries(s).map(([k, v]) => `\`${k === '_id' ? 'id' : k}\` ${v === -1 || v === 'desc' ? 'DESC' : 'ASC'}`);
          if (sortCols.length > 0) this._sort = `ORDER BY ${sortCols.join(', ')}`;
        }
        return this;
      },
      select(sel) { return this; },
      lean() { return this; },
      populate() { return this; },
      then: (resolve, reject) => {
        const sql = `SELECT * FROM ${sourceSql} ${whereClause} ${queryObj._sort} LIMIT 1`;
        pool.query(sql, values)
          .then(([rows]) => resolve(rows.length > 0 ? this._parseRow(rows[0]) : null))
          .catch(async (err) => {
            if (err.code === 'ER_NO_SUCH_TABLE') {
              try {
                const fallbackSql = `SELECT * FROM \`${this.tableName}\` ${whereClause} ${queryObj._sort} LIMIT 1`;
                const [rows] = await pool.query(fallbackSql, values);
                return resolve(rows.length > 0 ? this._parseRow(rows[0]) : null);
              } catch (_) {
                return resolve(null);
              }
            }
            reject(err);
          });
      },
      catch: (reject) => {
        const sql = `SELECT * FROM ${sourceSql} ${whereClause} ${queryObj._sort} LIMIT 1`;
        return pool.query(sql, values).catch(reject);
      }
    };
    return queryObj;
  }

  // Find by ID
  findById(id) {
    if (id === undefined || id === null) {
      return {
        select: () => this,
        lean: () => this,
        populate: () => this,
        then: (resolve) => resolve(null),
        catch: () => {}
      };
    }
    const sourceSql = this._getSourceSql({});
    const queryObj = {
      select(sel) { return this; },
      lean() { return this; },
      populate() { return this; },
      then: (resolve, reject) => {
        const sql = `SELECT * FROM ${sourceSql} WHERE \`${this.primaryKey}\` = ? LIMIT 1`;
        pool.query(sql, [id])
          .then(([rows]) => resolve(rows.length > 0 ? this._parseRow(rows[0]) : null))
          .catch(async (err) => {
            if (err.code === 'ER_NO_SUCH_TABLE') {
              try {
                const fallbackSql = `SELECT * FROM \`${this.tableName}\` WHERE \`${this.primaryKey}\` = ? LIMIT 1`;
                const [rows] = await pool.query(fallbackSql, [id]);
                return resolve(rows.length > 0 ? this._parseRow(rows[0]) : null);
              } catch (_) {
                return resolve(null);
              }
            }
            reject(err);
          });
      },
      catch: (reject) => {
        const sql = `SELECT * FROM ${sourceSql} WHERE \`${this.primaryKey}\` = ? LIMIT 1`;
        return pool.query(sql, [id]).catch(reject);
      }
    };
    return queryObj;
  }

  // Create new record
  async create(data) {
    const record = Array.isArray(data) ? data[0] : data;
    const shopId = record.shopId ? Number(record.shopId) : 1;
    let targetTable = (this.isBranchEntity && BRANCH_TABLE_PREFIXES[shopId])
      ? `${BRANCH_TABLE_PREFIXES[shopId]}__${this.tableName}`
      : this.tableName;

    let validCols = await getTableColumns(targetTable);
    if (!validCols) {
      targetTable = this.tableName;
      validCols = await getTableColumns(targetTable);
    }
    const cleanData = {};

    for (const [key, val] of Object.entries(record)) {
      if (key === '_id' || key === 'id' && val === undefined) continue;
      if (key === '__v' || typeof val === 'function') continue;
      if (validCols && !validCols.has(key)) continue;

      if (this.jsonFields.includes(key)) {
        cleanData[key] = Array.isArray(val) || typeof val === 'object' ? JSON.stringify(val) : '[]';
      } else if (typeof val === 'boolean') {
        cleanData[key] = val ? 1 : 0;
      } else {
        cleanData[key] = val;
      }
    }

    const cols = Object.keys(cleanData).map(k => `\`${k}\``).join(', ');
    const placeholders = Object.keys(cleanData).map(() => '?').join(', ');
    const vals = Object.values(cleanData);

    const sql = `INSERT INTO \`${targetTable}\` (${cols}) VALUES (${placeholders})`;
    const [result] = await pool.query(sql, vals);
    const newId = result.insertId || cleanData[this.primaryKey];
    if (this.isBranchEntity && shopId) {
      return await this.findOne({ [this.primaryKey]: newId, shopId });
    }
    return await this.findById(newId);
  }

  // Find by ID and update
  async findByIdAndUpdate(id, updateData, options = {}) {
    const targetTables = this.isBranchEntity
      ? ALL_BRANCH_PREFIXES.map(p => `${p}__${this.tableName}`)
      : [this.tableName];

    const rawUpdate = updateData.$set || updateData;

    for (const targetTable of targetTables) {
      const validCols = await getTableColumns(targetTable);
      if (!validCols) continue;

      const cleanData = {};
      const setClauses = [];
      const vals = [];

      // Handle $inc
      if (updateData.$inc && typeof updateData.$inc === 'object') {
        for (const [k, incVal] of Object.entries(updateData.$inc)) {
          if (validCols && !validCols.has(k)) continue;
          setClauses.push(`\`${k}\` = \`${k}\` + ?`);
          vals.push(Number(incVal) || 0);
        }
      }

      for (const [key, val] of Object.entries(rawUpdate)) {
        if (key === '_id' || key === 'id' || key === '__v') continue;
        if (key === '$inc' || typeof val === 'function') continue;
        if (validCols && !validCols.has(key)) continue;

        if (this.jsonFields.includes(key)) {
          cleanData[key] = Array.isArray(val) || typeof val === 'object' ? JSON.stringify(val) : '[]';
        } else if (typeof val === 'boolean') {
          cleanData[key] = val ? 1 : 0;
        } else {
          cleanData[key] = val;
        }
        setClauses.push(`\`${key}\` = ?`);
        vals.push(cleanData[key]);
      }

      if (setClauses.length > 0) {
        vals.push(id);
        const sql = `UPDATE \`${targetTable}\` SET ${setClauses.join(', ')} WHERE \`${this.primaryKey}\` = ?`;
        await pool.query(sql, vals);
      }
    }

    return await this.findById(id);
  }

  // Find one and update
  async findOneAndUpdate(query, updateData, options = {}) {
    const existing = await this.findOne(query);
    if (!existing) {
      if (options.upsert) {
        return await this.create({ ...query, ...(updateData.$set || updateData) });
      }
      return null;
    }
    return await this.findByIdAndUpdate(existing[this.primaryKey], updateData, options);
  }

  // Find by ID and delete
  async findByIdAndDelete(id) {
    const existing = await this.findById(id);
    if (existing) {
      const targetTables = this.isBranchEntity
        ? ALL_BRANCH_PREFIXES.map(p => `${p}__${this.tableName}`)
        : [this.tableName];

      for (const targetTable of targetTables) {
        try {
          await pool.query(`DELETE FROM \`${targetTable}\` WHERE \`${this.primaryKey}\` = ?`, [id]);
        } catch (_) {}
      }
    }
    return existing;
  }

  async findOneAndDelete(query) {
    const existing = await this.findOne(query);
    if (existing) {
      await this.findByIdAndDelete(existing[this.primaryKey]);
    }
    return existing;
  }

  // Count documents
  async countDocuments(query = {}) {
    const sourceSql = this._getSourceSql(query);
    const { whereClause, values } = this._buildWhere(query);
    const sql = `SELECT COUNT(*) as total FROM ${sourceSql} ${whereClause}`;
    const [rows] = await pool.query(sql, values);
    return Number(rows[0]?.total) || 0;
  }

  // Delete many
  async deleteMany(query = {}) {
    const targetTables = this.isBranchEntity
      ? (query.shopId && BRANCH_TABLE_PREFIXES[query.shopId]
          ? [`${BRANCH_TABLE_PREFIXES[query.shopId]}__${this.tableName}`]
          : ALL_BRANCH_PREFIXES.map(p => `${p}__${this.tableName}`))
      : [this.tableName];

    let deletedCount = 0;
    for (const targetTable of targetTables) {
      const { whereClause, values } = this._buildWhere(query);
      const sql = `DELETE FROM \`${targetTable}\` ${whereClause}`;
      const [result] = await pool.query(sql, values);
      deletedCount += result.affectedRows;
    }
    return { deletedCount };
  }
}
