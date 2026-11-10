import request from 'supertest';
import pool from '../config/mysql.js';
import jwt from 'jsonwebtoken';

const app = 'http://localhost:5006';

describe('Vendor API Authorization', () => {
  let shopAdminToken;
  let cashierToken;
  let shopAdminBToken;
  let superAdminToken;

  beforeAll(async () => {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
    const secret = process.env.JWT_SECRET;

    // Create tokens
    shopAdminToken = jwt.sign({ id: 101, role: 'shop_admin', shopId: 1 }, secret);
    cashierToken = jwt.sign({ id: 102, role: 'cashier', shopId: 1 }, secret);
    shopAdminBToken = jwt.sign({ id: 103, role: 'shop_admin', shopId: 2 }, secret);
    superAdminToken = jwt.sign({ id: 104, role: 'super_admin' }, secret);

    // Prepare test data
    await pool.query('DELETE FROM vendors WHERE shopId IN (1, 2, 999)');
    await pool.query('DELETE FROM users WHERE id IN (101, 102, 103, 104)');

    // Insert test users matching the actual users table schema
    await pool.query(`INSERT IGNORE INTO users (id, username, email, password, role, shopId, status) VALUES
      (101, 'testadmin1', 'ta1@test.com', 'hash', 'shop_admin', 1, 'active'),
      (102, 'testcashier', 'tc1@test.com', 'hash', 'cashier', 1, 'active'),
      (103, 'testadmin2', 'ta2@test.com', 'hash', 'shop_admin', 2, 'active'),
      (104, 'testsuper', 'ts1@test.com', 'hash', 'super_admin', NULL, 'active')
    `);

    // Ensure test shops exist
    await pool.query(`INSERT IGNORE INTO shops (id, name) VALUES (1, 'Test Shop 1'), (2, 'Test Shop 2')`);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM vendors WHERE shopId IN (1, 2, 999)');
    await pool.query('DELETE FROM users WHERE id IN (101, 102, 103, 104)');
    await pool.end();
  });

  // ─── 1. Unauthenticated GET, POST, PUT, DELETE individually = 401 ───
  it('Unauthenticated GET /full = 401', async () => {
    const res = await request(app).get('/api/vendors/1/full');
    expect(res.status).toBe(401);
  });

  it('Unauthenticated GET selector = 401', async () => {
    const res = await request(app).get('/api/vendors/1');
    expect(res.status).toBe(401);
  });

  it('Unauthenticated POST = 401', async () => {
    const res = await request(app).post('/api/vendors/1').send({ name: 'Unauth' });
    expect(res.status).toBe(401);
  });

  it('Unauthenticated PUT = 401', async () => {
    const res = await request(app).put('/api/vendors/1/999').send({ name: 'Unauth' });
    expect(res.status).toBe(401);
  });

  it('Unauthenticated DELETE = 401', async () => {
    const res = await request(app).delete('/api/vendors/1/999');
    expect(res.status).toBe(401);
  });

  // ─── 2. Cashier POST, PUT, DELETE individually = 403 ───
  it('Cashier POST = 403', async () => {
    const res = await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Forbidden Vendor' });
    expect(res.status).toBe(403);
  });

  it('Cashier PUT = 403', async () => {
    const res = await request(app).put('/api/vendors/1/999')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Forbidden' });
    expect(res.status).toBe(403);
  });

  it('Cashier DELETE = 403', async () => {
    const res = await request(app).delete('/api/vendors/1/999')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(403);
  });

  // ─── 3. Shop admin CREATE, LIST, UPDATE, ARCHIVE complete flow ───
  let createdVendorId;

  it('Shop admin CREATE vendor = 201', async () => {
    const res = await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: 'Flow Vendor', phone: '0300-1234567', location: 'Peshawar' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Flow Vendor');
    expect(res.body.phone).toBe('0300-1234567');
    createdVendorId = res.body.id;
  });

  it('Shop admin LIST vendors = 200', async () => {
    const res = await request(app).get('/api/vendors/1/full')
      .set('Authorization', `Bearer ${shopAdminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find(v => v.name === 'Flow Vendor')).toBeDefined();
  });

  it('Shop admin UPDATE vendor = 200', async () => {
    const res = await request(app).put(`/api/vendors/1/${createdVendorId}`)
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: 'Flow Vendor Updated', phone: '0301-9999999', location: 'Mardan' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Vendor updated');
  });

  it('Shop admin ARCHIVE vendor = 200', async () => {
    const res = await request(app).delete(`/api/vendors/1/${createdVendorId}`)
      .set('Authorization', `Bearer ${shopAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Vendor archived successfully');
  });

  // ─── 4. Cashier selector GET returns only id/name ───
  it('Cashier selector returns only id and name', async () => {
    // Create a vendor first so the list is non-empty
    await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: 'Selector Test Vendor', phone: '111', location: 'XYZ' });

    const res = await request(app).get('/api/vendors/1')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    const vendor = res.body[0];
    expect(vendor).toHaveProperty('id');
    expect(vendor).toHaveProperty('name');
    expect(vendor).not.toHaveProperty('phone');
    expect(vendor).not.toHaveProperty('location');
    expect(vendor).not.toHaveProperty('isActive');
    expect(vendor).not.toHaveProperty('archivedAt');
  });

  // ─── 5. Cross-shop GET, POST, PUT, DELETE = 403 ───
  it('Cross-shop GET /full = 403', async () => {
    const res = await request(app).get('/api/vendors/2/full')
      .set('Authorization', `Bearer ${shopAdminToken}`);
    expect(res.status).toBe(403);
  });

  it('Cross-shop POST = 403', async () => {
    const res = await request(app).post('/api/vendors/2')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: 'Cross Shop' });
    expect(res.status).toBe(403);
  });

  it('Cross-shop PUT = 403', async () => {
    const res = await request(app).put('/api/vendors/2/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: 'Cross Shop' });
    expect(res.status).toBe(403);
  });

  it('Cross-shop DELETE = 403', async () => {
    const res = await request(app).delete('/api/vendors/2/1')
      .set('Authorization', `Bearer ${shopAdminToken}`);
    expect(res.status).toBe(403);
  });

  // ─── 6. Super admin valid target shop succeeds ───
  it('Super admin GET valid target shop = 200', async () => {
    const res = await request(app).get('/api/vendors/2/full')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('Super admin POST to valid target shop = 201', async () => {
    const res = await request(app).post('/api/vendors/2')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Super Admin Vendor', phone: '000', location: 'HQ' });
    expect(res.status).toBe(201);
    expect(res.body.shopId).toBe(2);
  });

  // ─── 7. Super admin nonexistent shopId is rejected ───
  it('Super admin nonexistent shopId = 404', async () => {
    const res = await request(app).get('/api/vendors/999/full')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(404);
  });

  // ─── 8. Archived vendor normal list mein absent ───
  it('Archived vendor does not appear in normal list', async () => {
    // Create and archive a vendor
    const createRes = await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: 'Archive Check Vendor' });
    const archiveId = createRes.body.id;

    await request(app).delete(`/api/vendors/1/${archiveId}`)
      .set('Authorization', `Bearer ${shopAdminToken}`);

    const list = await request(app).get('/api/vendors/1/full')
      .set('Authorization', `Bearer ${shopAdminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.find(v => v.id === archiveId)).toBeUndefined();

    // Also absent from cashier selector
    const selector = await request(app).get('/api/vendors/1')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(selector.body.find(v => v.id === archiveId)).toBeUndefined();
  });

  // ─── 9. Archived vendor reactivation behavior verified ───
  it('Creating vendor with same name as archived reactivates it', async () => {
    // Create a vendor, archive it, then create again with same name
    const createRes = await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: 'Reactivation Vendor', phone: '111', location: 'Old' });
    const originalId = createRes.body.id;

    await request(app).delete(`/api/vendors/1/${originalId}`)
      .set('Authorization', `Bearer ${shopAdminToken}`);

    // Recreate with same name — should reactivate, not 409
    const reactivateRes = await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: 'Reactivation Vendor', phone: '222', location: 'New' });
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.id).toBe(originalId);
    expect(reactivateRes.body.phone).toBe('222');

    // Now should appear in list again
    const list = await request(app).get('/api/vendors/1/full')
      .set('Authorization', `Bearer ${shopAdminToken}`);
    expect(list.body.find(v => v.id === originalId)).toBeDefined();
  });

  // ─── 10. Invalid input = 400 ───
  it('Empty name = 400', async () => {
    const res = await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('Whitespace-only name = 400', async () => {
    const res = await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('Missing name = 400', async () => {
    const res = await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ phone: '123' });
    expect(res.status).toBe(400);
  });

  it('Invalid shopId in URL = 400', async () => {
    const res = await request(app).get('/api/vendors/abc/full')
      .set('Authorization', `Bearer ${shopAdminToken}`);
    expect(res.status).toBe(400);
  });

  // ─── 11. Duplicate active vendor = 409 ───
  it('Duplicate active vendor name = 409', async () => {
    const uniqueName = 'Unique Dup Test ' + Date.now();
    await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: uniqueName });

    const dupRes = await request(app).post('/api/vendors/1')
      .set('Authorization', `Bearer ${shopAdminToken}`)
      .send({ name: uniqueName });
    expect(dupRes.status).toBe(409);
  });
});
