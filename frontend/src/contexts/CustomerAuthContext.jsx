import React, { createContext, useContext, useState, useEffect } from 'react';

const CustomerAuthContext = createContext();

const API = '/api/customers';

export function CustomerAuthProvider({ shopId, children }) {
  const STORAGE_KEY = `customer_token_${shopId}`;
  const GUEST_CART_KEY = `pos_guest_cart_${shopId}`;

  const [customer, setCustomer] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [cart, setCart] = useState(() => {
    if (customer?.cart && Array.isArray(customer.cart) && customer.cart.length > 0) {
      return customer.cart;
    }
    try {
      const saved = localStorage.getItem(GUEST_CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [cartOpen, setCartOpen] = useState(false);

  const authHeader = customer
    ? { Authorization: `Bearer ${customer.customerId}` }
    : {};

  // Persist guest cart
  useEffect(() => {
    if (!customer) {
      try {
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
      } catch (e) {}
    }
  }, [cart, customer, GUEST_CART_KEY]);

  const register = async ({ fullName, email, password }) => {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, shopId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data;
  };

  const login = async ({ email, password }) => {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, shopId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    
    // If a staff member (Shop Admin) logs into the customer portal
    if (data.token && data.role !== 'customer') {
      localStorage.setItem('nexflow_token', data.token);
    }

    const customerData = {
      customerId: data.customerId,
      fullName: data.fullName,
      email: data.email,
      role: data.role || 'customer'
    };
    setCustomer(customerData);
    setCart(data.cart || []);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(customerData));
    return data;
  };

  const logout = () => {
    setCustomer(null);
    setCart([]);
    sessionStorage.removeItem(STORAGE_KEY);
    try { localStorage.removeItem(GUEST_CART_KEY); } catch (e) {}
  };

  // Add a single product to cart (works for both logged in and guest customers)
  const addToCart = async (item, quantity = 1, unit = 'egg', unitPrice = 0) => {
    const finalPrice = unitPrice > 0 ? unitPrice : (Number(item.price) || 0);
    const cleanName = (item.name || 'Egg Product').replace(/\s*\((Peti|Tray|Egg)\)/gi, '').trim();
    const unitLower = String(unit || 'egg').toLowerCase();
    const unitLabel = unitLower === 'peti' ? 'Peti' : unitLower === 'tray' ? 'Tray' : 'Egg';
    const itId = item._id || item.id || item.itemId || item.productId;
    const addQty = Math.max(1, Number(quantity) || 1);
    const itemImg = (item.images && item.images[0]) || item.image || '';

    // 1. Instant Optimistic Update to UI & LocalStorage
    setCart(prev => {
      const next = [...prev];
      const existing = next.find(c =>
        String(c.itemId || c.productId || c.id || c._id) === String(itId) &&
        String(c.unit || 'egg').toLowerCase() === unitLower
      );
      if (existing) {
        existing.quantity = (Number(existing.quantity) || 0) + addQty;
        if (finalPrice > 0) existing.price = finalPrice;
      } else {
        next.push({
          itemId: itId,
          productId: itId,
          id: itId,
          _id: itId,
          name: `${cleanName} (${unitLabel})`,
          unit: unitLower,
          price: finalPrice,
          image: itemImg,
          quantity: addQty
        });
      }
      try { localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });

    // 2. Sync with Backend if Customer is Logged In
    if (customer) {
      try {
        const res = await fetch(`${API}/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            itemId: itId,
            productId: itId,
            name: cleanName,
            quantity: addQty,
            unit: unitLower,
            price: finalPrice,
            image: itemImg
          })
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.cart)) {
          setCart(data.cart);
        }
      } catch (err) {
        console.warn('Background sync failed, cart retained locally:', err.message);
      }
    }
    return true;
  };

  // Add multiple products in bulk dynamically
  const addMultipleToCart = async (itemsList = []) => {
    if (!Array.isArray(itemsList) || itemsList.length === 0) return true;

    // 1. Instant Optimistic Update
    setCart(prev => {
      const next = [...prev];
      for (const item of itemsList) {
        const itId = item._id || item.id || item.itemId || item.productId;
        const unitLower = String(item.unit || 'tray').toLowerCase();
        const unitLabel = unitLower === 'peti' ? 'Peti' : unitLower === 'tray' ? 'Tray' : 'Egg';
        const cleanName = (item.name || 'Egg Product').replace(/\s*\((Peti|Tray|Egg)\)/gi, '').trim();
        const finalPrice = Number(item.price) || 0;
        const addQty = Math.max(1, Number(item.quantity) || 1);
        const itemImg = (item.images && item.images[0]) || item.image || '';

        const existing = next.find(c =>
          String(c.itemId || c.productId || c.id || c._id) === String(itId) &&
          String(c.unit || 'egg').toLowerCase() === unitLower
        );
        if (existing) {
          existing.quantity = (Number(existing.quantity) || 0) + addQty;
          if (finalPrice > 0) existing.price = finalPrice;
        } else {
          next.push({
            itemId: itId,
            productId: itId,
            id: itId,
            _id: itId,
            name: `${cleanName} (${unitLabel})`,
            unit: unitLower,
            price: finalPrice,
            image: itemImg,
            quantity: addQty
          });
        }
      }
      try { localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });

    // 2. Sync with Backend
    if (customer) {
      try {
        const res = await fetch(`${API}/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ items: itemsList })
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.cart)) {
          setCart(data.cart);
        }
      } catch (err) {
        console.warn('Background sync failed:', err.message);
      }
    }
    return true;
  };

  const updateCartItem = async (itemId, quantity, unit) => {
    const targetUnit = String(unit || 'egg').toLowerCase();
    const newQty = Number(quantity);

    // 1. Instant Optimistic Update
    setCart(prev => {
      let next;
      if (newQty <= 0) {
        next = prev.filter(c => !(
          String(c.itemId || c.productId || c.id || c._id) === String(itemId) &&
          String(c.unit || 'egg').toLowerCase() === targetUnit
        ));
      } else {
        next = prev.map(c => {
          if (
            String(c.itemId || c.productId || c.id || c._id) === String(itemId) &&
            String(c.unit || 'egg').toLowerCase() === targetUnit
          ) {
            return { ...c, quantity: newQty };
          }
          return c;
        });
      }
      try { localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });

    // 2. Sync with Backend
    if (customer) {
      try {
        const res = await fetch(`${API}/cart/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ quantity: newQty, unit: targetUnit })
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.cart)) {
          setCart(data.cart);
        }
      } catch (err) {
        console.warn('Update cart item sync failed:', err.message);
      }
    }
  };

  const removeFromCart = async (itemId, unit) => {
    const targetUnit = String(unit || 'egg').toLowerCase();

    // 1. Instant Optimistic Update
    setCart(prev => {
      const next = prev.filter(c => !(
        String(c.itemId || c.productId || c.id || c._id) === String(itemId) &&
        String(c.unit || 'egg').toLowerCase() === targetUnit
      ));
      try { localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });

    // 2. Sync with Backend
    if (customer) {
      try {
        const query = targetUnit ? `?unit=${encodeURIComponent(targetUnit)}` : '';
        const res = await fetch(`${API}/cart/${itemId}${query}`, {
          method: 'DELETE',
          headers: authHeader
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.cart)) {
          setCart(data.cart);
        }
      } catch (err) {
        console.warn('Remove from cart sync failed:', err.message);
      }
    }
  };

  const updateCartItemUnit = async (itemId, currentUnit, newUnit) => {
    const fromUnit = String(currentUnit || 'egg').toLowerCase();
    const toUnit = String(newUnit || 'tray').toLowerCase();

    // 1. Instant Optimistic Update
    setCart(prev => {
      const next = prev.map(c => {
        if (
          String(c.itemId || c.productId || c.id || c._id) === String(itemId) &&
          String(c.unit || 'egg').toLowerCase() === fromUnit
        ) {
          const unitLabel = toUnit === 'peti' ? 'Peti' : toUnit === 'tray' ? 'Tray' : 'Egg';
          const cleanName = (c.name || '').replace(/\s*\((Peti|Tray|Egg)\)/gi, '').trim();
          let p = Number(c.price) || 0;
          if (fromUnit === 'egg') {
            if (toUnit === 'tray') p = p * 30;
            else if (toUnit === 'peti') p = p * 360;
          } else if (fromUnit === 'tray') {
            if (toUnit === 'egg') p = Math.round((p / 30) * 10) / 10;
            else if (toUnit === 'peti') p = p * 12;
          } else if (fromUnit === 'peti') {
            if (toUnit === 'tray') p = Math.round(p / 12);
            else if (toUnit === 'egg') p = Math.round((p / 360) * 10) / 10;
          }
          return {
            ...c,
            unit: toUnit,
            name: `${cleanName} (${unitLabel})`,
            price: p
          };
        }
        return c;
      });
      try { localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });

    // 2. Sync with Backend
    if (customer) {
      try {
        const res = await fetch(`${API}/cart/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ unit: fromUnit, newUnit: toUnit })
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.cart)) {
          setCart(data.cart);
        }
      } catch (err) {
        console.warn('Update cart unit sync failed:', err.message);
      }
    }
  };

  const clearCart = async () => {
    setCart([]);
    try { localStorage.removeItem(GUEST_CART_KEY); } catch (e) {}

    if (customer) {
      try {
        const res = await fetch(`${API}/cart`, {
          method: 'DELETE',
          headers: authHeader
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.cart)) {
          setCart(data.cart);
        }
      } catch (err) {
        console.warn('Clear cart sync failed:', err.message);
      }
    }
  };

  const getMyOrders = async () => {
    const res = await fetch('/api/checkout/my-orders', { headers: authHeader });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load orders');
    return data.orders || [];
  };

  const cartTotal = (cart || []).reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
  const cartCount = (cart || []).reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

  return (
    <CustomerAuthContext.Provider value={{
      customer, cart, cartOpen, setCartOpen,
      cartTotal, cartCount, authHeader,
      register, login, logout,
      addToCart, addMultipleToCart, updateCartItem, updateCartItemUnit, removeFromCart, clearCart, getMyOrders
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  return useContext(CustomerAuthContext);
}
