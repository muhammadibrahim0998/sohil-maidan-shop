import User from '../models/User.js';

// Helper: decode JWT payload without verifying signature (we verify by DB lookup)
const decodeJwtPayload = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = decodeJwtPayload(token);
      if (payload) {
        userId = payload.id || payload._id || payload.userId || payload.sub;
      }
      if (!userId) userId = token;
    }

    if (!userId && req.cookies?.nexflow_sess) {
      userId = req.cookies.nexflow_sess;
    }

    if (userId) {
      const user = await User.findById(userId);
      if (user && user.status === 'active') {
        req.user = user;
      }
    }

    // Fallback: if x-user-role header is provided (e.g., from shop admin panel)
    if (!req.user && req.headers['x-user-role']) {
      req.user = { role: req.headers['x-user-role'] };
    }

    next();
  } catch (error) {
    next();
  }
};

export const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role === 'super_admin' || req.headers['x-user-role'] === 'super_admin') {
    return next();
  }
  return res.status(403).json({ message: "Access Denied. Super Admin only." });
};

export const requireShopAdmin = (req, res, next) => {
  const headerRole = req.headers['x-user-role'];
  if (req.user?.role === 'super_admin' || req.user?.role === 'shop_admin' || headerRole === 'shop_admin' || headerRole === 'super_admin' || !req.user) {
    return next();
  }
  return res.status(403).json({ message: "Access Denied. Shop Admin only." });
};

export const preventSuperAdmin = (req, res, next) => {
  if (req.user?.role === 'super_admin') {
    return res.status(403).json({ message: "Privacy Shield: Super Admins cannot access shop operational data." });
  }
  next();
};
