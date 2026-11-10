import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getItems, getSales } from '../services/api';
import { toast } from 'sonner';
import { useDebounce } from '../hooks/useDebounce';
import { useUser } from './UserContext';


const ProductContext = createContext();

export function useProducts() {
  const context = useContext(ProductContext);
  if (!context) {
    return { products: [], sales: [], loading: false, fetchProducts: () => {}, fetchSales: () => {} };
  }
  return context;
}

function getStockStatus(stock, minStock) {
  if (stock === 0)
    return {
      label: "Out of Stock",
      color: "bg-red-100 text-red-700 border-red-200",
    };
  if (stock < minStock)
    return {
      label: "Low Stock",
      color: "bg-amber-100 text-amber-700 border-amber-200",
    };
  if (stock < minStock * 1.5)
    return {
      label: "Medium",
      color: "bg-green-100 text-green-700 border-green-200",
    };
  return {
    label: "In Stock",
    color: "bg-green-100 text-green-700 border-green-200",
  };
}

export function ProductProvider({ children }) {
  const [products, setProducts] = useState(() => {
    try {
      const cached = localStorage.getItem('nexflow_cached_products');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Sorting
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Cart
  const [cart, setCart] = useState([]);

  // Move useUser inside the component to avoid circular dependency if any, 
  // but it's safe here as UserProvider wraps ProductProvider.
  const { user } = useUser();

  // Track whether it's the first load (show spinner) vs background refresh (silent)
  const [initialLoad, setInitialLoad] = useState(true);

  // Fetch logic
  useEffect(() => {
    if (user) {
      fetchData(false); // fast silent refresh if already cached
      const timer = setInterval(() => {
        fetchData(false); // background refresh → no spinner
      }, 8000);
      return () => clearInterval(timer);
    }
  }, [user]);

  const fetchData = async (showSpinner = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      if (showSpinner) setLoading(true);
      const activeShopId = user?.shopId ? (typeof user.shopId === 'object' ? (user.shopId._id || user.shopId.id) : String(user.shopId)) : null;
      const [productsData, salesData] = await Promise.all([
        getItems(activeShopId).catch(() => null),
        getSales(activeShopId).catch(() => null)
      ]);
      if (Array.isArray(productsData)) {
        setProducts(productsData);
        try {
          localStorage.setItem('nexflow_cached_products', JSON.stringify(productsData));
        } catch (e) {}
      }
      if (Array.isArray(salesData)) {
        setSales(salesData);
      }
      setInitialLoad(false);
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Derived State: Filtering & Sorting (Dynamically derived only from real added products)
  const categories = useMemo(() => {
    const productCats = (products || []).map((p) => p.category).filter(Boolean);
    return ["All", ...Array.from(new Set(productCats))];
  }, [products]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (product._id && product._id.toString().includes(debouncedSearchTerm));
    const matchesCategory =
      categoryFilter === "All" || product.category === categoryFilter;
    const status = getStockStatus(product.stock, product.minStock);
    const matchesStatus =
      statusFilter === "All" || status.label === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  }), [products, debouncedSearchTerm, categoryFilter, statusFilter]);

  const sortedProducts = useMemo(() => [...filteredProducts].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  }), [filteredProducts, sortConfig]);


  // Cart Actions
  const addToCart = (product) => {
    if (product.stock <= 0) {
      toast.error("Cannot add out of stock item to cart.");
      return;
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.productId === product._id);
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          toast.error(`Only ${product.stock} items available in stock.`);
          return prevCart;
        }
        toast.success(`Increased ${product.name} quantity`);
        return prevCart.map((item) =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        );
      }
      toast.success(`${product.name} added to cart`);
      return [
        ...prevCart,
        {
          productId: product._id,
          name: product.name,
          price: product.price,
          costPrice: product.costPrice || 0,
          quantity: 1,
          subtotal: product.price,
          stock: product.stock, // Added for quantity limits
        },
      ];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateQuantity = (productId, delta, maxStock) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const newQty = item.quantity + delta;
          if (newQty > 0 && newQty <= maxStock) {
            return { ...item, quantity: newQty, subtotal: newQty * item.price };
          }
        }
        return item;
      })
    );
  };

  const clearCart = () => setCart([]);

  const value = {
    products, setProducts,
    sales, setSales,
    loading,
    initialLoad,
    fetchData,
    categories,
    filteredProducts: sortedProducts, // We expose the sorted & filtered list
    searchTerm, setSearchTerm,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    sortConfig, setSortConfig,
    currentPage, setCurrentPage,
    itemsPerPage, setItemsPerPage,
    cart, addToCart, removeFromCart, updateQuantity, clearCart,
    getStockStatus
  };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
}
