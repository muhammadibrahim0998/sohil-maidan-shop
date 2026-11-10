import express from 'express';
import { authenticate, requireShopAdmin } from '../middleware/auth.js';
import { validateProduct } from '../validators/productValidator.js';
const router = express.Router();
import {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  settleSupplierCredit,
  updateVendor,
  deleteVendor,
  deletePurchaseCredit,
  getPurchaseCredits,
  getVendors,
  createVendor
} from '../controllers/itemController.js';

router.route('/')
  .get(authenticate, getItems)
  .post(authenticate, requireShopAdmin, validateProduct, createItem);

router.route('/all')
  .get(authenticate, getItems);

router.route('/purchase-credits')
  .get(authenticate, getPurchaseCredits);

// Vendor & Purchase Credit update & delete endpoints (placed before /:id to prevent slug collisions)
router.get('/vendors', authenticate, getVendors);
router.post('/vendors', authenticate, requireShopAdmin, createVendor);
router.post('/vendor/create', authenticate, requireShopAdmin, createVendor);
router.put('/vendor/update', authenticate, requireShopAdmin, updateVendor);
router.post('/vendor/update', authenticate, requireShopAdmin, updateVendor);
router.post('/vendor/delete', authenticate, requireShopAdmin, deleteVendor);
router.delete('/vendor/delete', authenticate, requireShopAdmin, deleteVendor);

router.delete('/purchase-credit/:id', authenticate, requireShopAdmin, deletePurchaseCredit);
router.post('/purchase-credit/delete', authenticate, requireShopAdmin, deletePurchaseCredit);

router.patch('/:id/settle-credit', authenticate, requireShopAdmin, settleSupplierCredit);
router.patch('/:id/settle-cash', authenticate, requireShopAdmin, settleSupplierCredit);
router.patch('/:id/settle-bank', authenticate, requireShopAdmin, settleSupplierCredit);

router.route('/:id')
  .get(authenticate, getItem)
  .put(authenticate, requireShopAdmin, validateProduct, updateItem)
  .delete(authenticate, requireShopAdmin, deleteItem);

export default router;
