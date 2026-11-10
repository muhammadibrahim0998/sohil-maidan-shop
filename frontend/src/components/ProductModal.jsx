import { useState, useEffect, useRef, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import CreatableSelect from 'react-select/creatable';
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema } from "../schemas/productSchema";
import { X, Upload, Loader2, Star, Box, Egg, UserCheck, ImageIcon, Link as LinkIcon, ShieldCheck, Camera, Plus, Banknote, CreditCard, AlertCircle, Building2 } from "lucide-react";
import { uploadImages, getVendors } from "../services/api";
import { useProducts } from "../contexts/ProductContext";
import { useUser } from "../contexts/UserContext";
import { toast } from "sonner";

export function ProductModal({ isOpen, onClose, onSave, product, mode, categories = [], suppliers = [] }) {
  const { products: allContextProducts = [] } = useProducts?.() || {};
  const { user } = useUser?.() || {};
  const shopId = user?.shopId ? (typeof user.shopId === 'object' ? (user.shopId._id || user.shopId.id) : user.shopId) : 1;
  const [dynamicSuppliers, setDynamicSuppliers] = useState([]);

  // Fetch all known suppliers & registered vendors whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setDynamicSuppliers([]);

    // 1. Fetch from registered vendors table for this branch
    getVendors(shopId)
      .then(data => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : (data?.vendors || []);
        const sList = list.map(v => ({
          name: (v.name || '').trim(),
          phone: v.phone || '',
          location: v.location || v.farmLocation || ''
        })).filter(v => Boolean(v.name));

        if (sList.length > 0) {
          setDynamicSuppliers(prev => {
            const map = new Map();
            prev.forEach(p => map.set(p.name.toLowerCase(), p));
            sList.forEach(s => map.set(s.name.toLowerCase(), s));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});

    // 2. Also fetch from items to ensure existing item supplier names are preserved
    fetch(`/api/items?shopId=${shopId}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
        const sList = [];
        list.forEach(item => {
          if (item?.supplierName && typeof item.supplierName === 'string' && item.supplierName.trim()) {
            sList.push({
              name: item.supplierName.trim(),
              phone: item.supplierPhone || item.supplierContact || '',
              location: item.supplierLocation || item.farmLocation || ''
            });
          }
        });
        if (sList.length > 0) {
          setDynamicSuppliers(prev => {
            const map = new Map();
            prev.forEach(p => map.set(p.name.toLowerCase(), p));
            sList.forEach(s => {
              if (!map.has(s.name.toLowerCase())) map.set(s.name.toLowerCase(), s);
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, [isOpen, shopId]);

  const knownSuppliers = useMemo(() => {
    const map = new Map();

    // Default registered suppliers / farms
    const initialSuppliers = [
      { name: 'samarbagh form house', phone: '03069578493', location: 'Dir lower' },
      { name: 'lohore form', phone: '03069578493', location: 'lahore' },
      { name: 'alfaham form peshawer', phone: '03069578493', location: 'peshawer' },
      { name: 'peshawer form', phone: '03069578493', location: 'peshawer' }
    ];

    initialSuppliers.forEach(s => {
      map.set(s.name.toLowerCase(), s);
    });

    (allContextProducts || []).forEach(p => {
      if (p.supplierName && typeof p.supplierName === 'string' && p.supplierName.trim()) {
        const name = p.supplierName.trim();
        if (!map.has(name.toLowerCase())) {
          map.set(name.toLowerCase(), {
            name,
            phone: p.supplierPhone || p.supplierContact || '',
            location: p.supplierLocation || p.farmLocation || ''
          });
        }
      }
    });

    (suppliers || []).forEach(s => {
      const sName = typeof s === 'string' ? s : (s?.supplierName || s?.name);
      if (sName && typeof sName === 'string' && sName.trim() && !map.has(sName.trim().toLowerCase())) {
        map.set(sName.trim().toLowerCase(), {
          name: sName.trim(),
          phone: s?.supplierPhone || s?.phone || '',
          location: s?.supplierLocation || s?.location || ''
        });
      }
    });

    (dynamicSuppliers || []).forEach(s => {
      if (s?.name && typeof s.name === 'string' && s.name.trim() && !map.has(s.name.trim().toLowerCase())) {
        map.set(s.name.trim().toLowerCase(), s);
      }
    });

    return Array.from(map.values());
  }, [allContextProducts, suppliers, dynamicSuppliers]);
  const { register, handleSubmit, reset, setValue, getValues, watch, control, formState: { errors } } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "", category: "", stock: 0, minStock: 0, price: 0, costPrice: 0,
      unitType: "peti", traysPerPeti: 12, eggsPerTray: 30,
      petiQuantity: 0, trayQuantity: 0, eggQuantity: 0,
      supplierName: "", totalPurchaseCost: 0, amountPaidToSupplier: 0, dueAmountToSupplier: 0, paymentMethod: "Cash",
      paymentReceipt: "", images: [], description: "", mfgDate: "", expiryDate: ""
    }
  });

  const [uploading, setUploading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const fileInputRef = useRef(null);

  const images = watch("images") || [];
  const currentCategory = watch("category");
  const unitType = watch("unitType") || "peti";

  const watchedPetiQty = watch("petiQuantity") || 0;
  const watchedTrayQty = watch("trayQuantity") || 0;
  const watchedEggQty = watch("eggQuantity") || 0;
  const watchedTraysPerPeti = watch("traysPerPeti") || 12;
  const watchedEggsPerTray = watch("eggsPerTray") || 30;
  const watchedCostPrice = watch("costPrice") || 0;
  const watchedAmountPaid = watch("amountPaidToSupplier") || 0;
  const watchedPaymentMethod = watch("paymentMethod") || "Cash";
  const isBankMode = String(watchedPaymentMethod).toLowerCase().includes('bank') || String(watchedPaymentMethod).toLowerCase().includes('online');

  // Live Unit & Stock Conversions
  const tPerPetiVal = Number(watchedTraysPerPeti) || 12;
  const ePerTrayVal = Number(watchedEggsPerTray) || 30;
  const eggsPerPeti = tPerPetiVal * ePerTrayVal;

  const totalEggsCalculated = Number(watchedEggQty) > 0 
    ? Number(watchedEggQty) 
    : (Number(watchedPetiQty) > 0 
        ? Math.round(Number(watchedPetiQty) * eggsPerPeti) 
        : (Number(watchedTrayQty) > 0 ? Math.round(Number(watchedTrayQty) * ePerTrayVal) : 0));

  const totalTraysCalculated = totalEggsCalculated > 0 
    ? Number((totalEggsCalculated / ePerTrayVal).toFixed(1)) 
    : 0;

  const totalPetisCalculated = totalEggsCalculated > 0 
    ? Number((totalEggsCalculated / (eggsPerPeti || 360)).toFixed(2)) 
    : 0;

  const watchedPrice = watch("price") || 0;

  // Live Supplier Bill & Due Calculations (uses costPrice or sale price as fallback)
  const unitRate = Number(watchedCostPrice) > 0 ? Number(watchedCostPrice) : Number(watchedPrice);
  const calculatedTotalBill = Number(watchedPetiQty) > 0 
    ? (Number(watchedPetiQty) * unitRate) 
    : (totalEggsCalculated > 0 ? (totalEggsCalculated * (unitRate / (eggsPerPeti || 360))) : 0);

  const [hasUserEditedPayment, setHasUserEditedPayment] = useState(false);

  // Auto-sync amountPaidToSupplier with calculatedTotalBill when bill updates ONLY if user hasn't typed a custom amount
  useEffect(() => {
    if (isOpen && mode !== "view" && !hasUserEditedPayment) {
      if (calculatedTotalBill > 0) {
        setValue("amountPaidToSupplier", calculatedTotalBill);
      }
    }
  }, [calculatedTotalBill, isOpen, mode, setValue, hasUserEditedPayment]);

  const watchedPaidNum = watchedAmountPaid !== undefined && watchedAmountPaid !== '' && !isNaN(Number(watchedAmountPaid)) 
    ? Number(watchedAmountPaid) 
    : 0;
  const calculatedDue = Math.max(0, calculatedTotalBill - watchedPaidNum);

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim() || images.length >= 5) return;
    const url = imageUrlInput.trim();
    if (!url.startsWith('http')) return;
    setValue("images", [...images, url]);
    setImageUrlInput("");
    if (images.length === 0) setSelectedImageIndex(0);
  };

  // Sync form with product prop
  useEffect(() => {
    if (isOpen) {
      setHasUserEditedPayment(mode === "edit" || mode === "view");
      if (product && mode !== "add") {
        const tPerP = product.traysPerPeti || 12;
        const ePerT = product.eggsPerTray || 30;
        const ePerP = tPerP * ePerT;

        const totalStockEggs = product.stock || (product.petiQuantity ? Math.round(product.petiQuantity * ePerP) : (product.eggQuantity || 0)) || 0;
        const initialPeti = product.petiQuantity !== undefined && product.petiQuantity !== null && product.petiQuantity > 0
          ? product.petiQuantity
          : (totalStockEggs > 0 ? Number((totalStockEggs / ePerP).toFixed(2)) : 0);
        const initialTray = product.trayQuantity !== undefined && product.trayQuantity !== null && product.trayQuantity > 0
          ? product.trayQuantity
          : (initialPeti > 0 ? Number((initialPeti * tPerP).toFixed(1)) : (totalStockEggs > 0 ? Number((totalStockEggs / ePerT).toFixed(1)) : 0));
        const initialEgg = product.eggQuantity !== undefined && product.eggQuantity !== null && product.eggQuantity > 0
          ? product.eggQuantity
          : (totalStockEggs > 0 ? totalStockEggs : (initialPeti > 0 ? Math.round(initialPeti * ePerP) : 0));

        reset({
          name: product.name || "",
          category: product.category || "Eggs",
          unitType: product.unitType || "peti",
          traysPerPeti: tPerP,
          eggsPerTray: ePerT,
          petiQuantity: initialPeti,
          trayQuantity: initialTray,
          eggQuantity: initialEgg,
          stock: totalStockEggs || initialEgg,
          minStock: product.minStock || 0,
          price: product.price || 0,
          costPrice: product.costPrice || 0,
          supplierName: product.supplierName || "",
          supplierPhone: product.supplierPhone || product.supplierContact || "",
          supplierLocation: product.supplierLocation || product.farmLocation || "",
          totalPurchaseCost: product.totalPurchaseCost || 0,
          amountPaidToSupplier: product.amountPaidToSupplier !== undefined ? product.amountPaidToSupplier : (product.totalPurchaseCost || 0),
          cashPaidToSupplier: product.cashPaidToSupplier || 0,
          bankPaidToSupplier: product.bankPaidToSupplier || 0,
          dueAmountToSupplier: product.dueAmountToSupplier || 0,
          paymentMethod: product.paymentMethod || "Cash",
          isOnlinePayment: Boolean(product.isOnlinePayment),
          paymentReceipt: product.paymentReceipt || "",
          images: (Array.isArray(product.images) && product.images.length > 0)
            ? product.images
            : (product.image ? [product.image] : (product.imageUrl ? [product.imageUrl] : ['/egg2.png'])),
          description: product.description || "",
          mfgDate: product.mfgDate ? new Date(product.mfgDate).toISOString().split('T')[0] : "",
          expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : "",
        });
      } else {
        reset({
          name: "",
          category: product?.category || "Eggs",
          unitType: "peti",
          traysPerPeti: 12,
          eggsPerTray: 30,
          petiQuantity: 0,
          trayQuantity: 0,
          eggQuantity: 0,
          stock: 0,
          minStock: 0,
          price: 0,
          costPrice: 0,
          supplierName: "",
          supplierPhone: "",
          supplierLocation: "",
          totalPurchaseCost: 0,
          amountPaidToSupplier: 0,
          dueAmountToSupplier: 0,
          paymentMethod: "Cash",
          paymentReceipt: "",
          images: [],
          description: "",
          mfgDate: "",
          expiryDate: ""
        });
      }
      setSelectedImageIndex(0);
    }
  }, [product, mode, isOpen, reset]);

  const onSubmit = (data) => {
    const tPerPeti = parseFloat(data.traysPerPeti) || 12;
    const ePerTray = parseFloat(data.eggsPerTray) || 30;
    const ePerPeti = tPerPeti * ePerTray;

    const pQty = parseFloat(data.petiQuantity) || 0;
    const tQty = parseFloat(data.trayQuantity) || (pQty > 0 ? Number((pQty * tPerPeti).toFixed(1)) : 0);
    const eQty = parseFloat(data.eggQuantity) || (pQty > 0 ? Math.round(pQty * ePerPeti) : (tQty > 0 ? Math.round(tQty * ePerTray) : 0));

    const finalStock = eQty > 0 ? eQty : (pQty > 0 ? Math.round(pQty * ePerPeti) : (parseFloat(data.stock) || 0));

    const costPriceVal = parseFloat(data.costPrice) || 0;
    const salePriceVal = parseFloat(data.price) || 0;
    const effectiveUnitPrice = costPriceVal > 0 ? costPriceVal : salePriceVal;

    let computedBill = calculatedTotalBill;
    if (computedBill <= 0) {
      if (pQty > 0) {
        computedBill = pQty * effectiveUnitPrice;
      } else if (finalStock > 0) {
        computedBill = finalStock * (effectiveUnitPrice / ePerPeti);
      }
    }

    const totalBill = computedBill > 0 ? computedBill : (parseFloat(data.totalPurchaseCost) || 0);
    
    // Explicit paid & due parsing
    let paidAmt = 0;
    if (data.amountPaidToSupplier !== undefined && data.amountPaidToSupplier !== "" && !isNaN(parseFloat(data.amountPaidToSupplier))) {
      paidAmt = Math.max(0, parseFloat(data.amountPaidToSupplier));
    } else {
      paidAmt = hasUserEditedPayment ? 0 : totalBill;
    }

    const dueAmt = Math.max(0, totalBill - paidAmt);
    const rawMethod = String(data.paymentMethod || "Cash").trim();
    const isOnlineOrBank = rawMethod.toLowerCase().includes('bank') || rawMethod.toLowerCase().includes('online') || data.isOnlinePayment === true;

    let cashPaid = 0;
    let bankPaid = 0;
    if (isOnlineOrBank) {
      bankPaid = paidAmt;
      cashPaid = 0;
    } else {
      cashPaid = paidAmt;
      bankPaid = 0;
    }

    let determinedMethod = "Cash";
    if (isOnlineOrBank) {
      determinedMethod = dueAmt > 0 && paidAmt === 0 
        ? "Credit" 
        : (dueAmt > 0 ? "Partial Bank Transfer" : "Bank Transfer");
    } else {
      determinedMethod = dueAmt > 0 && paidAmt === 0 
        ? "Credit" 
        : (dueAmt > 0 ? "Partial Cash" : "Cash");
    }

    const payload = {
      ...data,
      name: data.name?.trim() || product?.name || "",
      category: data.category || currentCategory || product?.category || "General",
      unitType: data.unitType || "peti",
      traysPerPeti: tPerPeti,
      eggsPerTray: ePerTray,
      petiQuantity: pQty,
      trayQuantity: tQty,
      eggQuantity: eQty,
      stock: finalStock,
      minStock: parseFloat(data.minStock) ?? product?.minStock ?? 0,
      price: parseFloat(data.price) > 0 
        ? parseFloat(data.price) 
        : (costPriceVal || product?.price || 0),
      costPrice: costPriceVal || product?.costPrice || 0,
      pricePerEgg: costPriceVal > 0 && ePerPeti > 0
        ? Number((costPriceVal / ePerPeti).toFixed(2))
        : (parseFloat(data.pricePerEgg) || product?.pricePerEgg || 0),
      pricePerTray: costPriceVal > 0 && tPerPeti > 0
        ? Number((costPriceVal / tPerPeti).toFixed(2))
        : (parseFloat(data.pricePerTray) || product?.pricePerTray || 0),
      pricePerPeti: costPriceVal > 0 ? costPriceVal : (parseFloat(data.pricePerPeti) || product?.pricePerPeti || 0),
      supplierName: data.supplierName?.trim() || "",
      supplierPhone: data.supplierPhone?.trim() || "",
      supplierLocation: data.supplierLocation?.trim() || "",
      totalPurchaseCost: totalBill,
      amountPaidToSupplier: paidAmt,
      cashPaidToSupplier: cashPaid,
      bankPaidToSupplier: bankPaid,
      dueAmountToSupplier: dueAmt,
      paymentMethod: determinedMethod,
      paymentReceipt: data.paymentReceipt || "",
      isOnlinePayment: isOnlineOrBank,
      images: (images && images.length > 0)
        ? images
        : ((Array.isArray(product?.images) && product.images.length > 0) 
            ? product.images 
            : (product?.image ? [product.image] : ['/egg2.png'])),
      description: data.description ?? "",
      lastUpdated: new Date().toISOString().split("T")[0],
    };

    if (!data.mfgDate) delete payload.mfgDate;
    if (!data.expiryDate) delete payload.expiryDate;

    onSave(payload);
    onClose();
  };


  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setUploading(true);
      const newImageUrls = await uploadImages(files);
      setValue("images", [...images, ...newImageUrls].slice(0, 5));
      toast.success("Product picture uploaded!");
    } catch (error) {
      toast.error("Image upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sleek Gray Card - Full Height from Navbar to Bottom */}
      <div className="relative w-full max-w-[530px] bg-[#e5e7eb] border border-gray-300 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden z-10 mx-auto flex flex-col text-slate-800 my-auto">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-300 bg-[#d1d5db] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-700 shadow-sm">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase leading-none">
                {mode === "add" ? "Add Product & Stock" : mode === "edit" ? "Edit Product" : "View Product"}
              </h2>
              <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider mt-0.5">Online POS Software • Stock Entry</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-300 rounded-lg transition-all text-slate-600 hover:text-slate-900 border border-gray-300/80 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Comfortable Spacious Height */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-3 sm:p-3.5 space-y-2.5 text-xs">

          {/* Row 1: Picture Upload & Basic Info */}
          <div className="p-2.5 bg-[#f3f4f6] rounded-xl border border-gray-300 space-y-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="relative w-9 h-9 bg-gray-200 rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center shrink-0">
                  {images.length > 0 && images[selectedImageIndex] ? (
                    <img src={images[selectedImageIndex]} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block leading-none">
                    Picture ({images.length}/5)
                  </span>
                  <span className="text-[8.5px] text-gray-500 font-medium block mt-0.5">Optional product image</span>
                </div>
              </div>

              {mode !== "view" && (
                <div className="flex items-center gap-1.5">
                  {images.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newImages = images.filter((_, i) => i !== selectedImageIndex);
                        setValue("images", newImages);
                        setSelectedImageIndex(Math.max(0, selectedImageIndex - 1));
                      }}
                      className="p-1 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-[8.5px] font-bold transition-all cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                  {images.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase rounded-lg tracking-wider flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      <span>Upload</span>
                    </button>
                  )}
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
            </div>

            {/* Product Name */}
            <div className="space-y-1">
              <label className="text-[9.5px] font-black text-slate-700 uppercase tracking-wider">Product Name *</label>
              <input
                {...register("name")}
                disabled={mode === "view"}
                className={`w-full bg-white border ${errors.name ? 'border-rose-500' : 'border-gray-300'} rounded-lg py-1.5 px-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 placeholder:text-gray-400`}
                placeholder="e.g. Super Jumbo Eggs (79g)"
              />
              {errors.name && <p className="text-rose-600 text-[9px] font-bold uppercase">{errors.name.message}</p>}
            </div>

            {/* Category & Primary Unit */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9.5px] font-black text-slate-700 uppercase tracking-wider">Category</label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => {
                    const mergedCats = Array.from(new Set((categories || []).filter(c => c !== "All")));
                    return (
                      <CreatableSelect
                        {...field}
                        isClearable
                        isDisabled={mode === 'view'}
                        options={mergedCats.map(c => ({ value: c, label: c }))}
                        onChange={(val) => field.onChange(val ? val.value : "")}
                        onCreateOption={(inputValue) => field.onChange(inputValue)}
                        value={field.value ? { label: field.value, value: field.value } : null}
                        placeholder="Select Category..."
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor: '#ffffff',
                            borderRadius: "0.5rem",
                            minHeight: "30px",
                            height: "30px",
                            fontSize: "11px",
                            borderColor: state.isFocused ? '#059669' : '#d1d5db',
                            fontWeight: 'bold',
                            color: '#0f172a',
                            boxShadow: 'none'
                          }),
                          menu: (base) => ({
                            ...base,
                            backgroundColor: '#ffffff',
                            borderRadius: "0.5rem",
                            fontSize: "11px",
                            border: '1px solid #d1d5db',
                            zIndex: 99
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isFocused ? '#ecfdf5' : 'transparent',
                            color: state.isFocused ? '#065f46' : '#0f172a',
                            fontSize: "11px"
                          }),
                          singleValue: (base) => ({ ...base, color: '#0f172a' }),
                          input: (base) => ({ ...base, color: '#0f172a', margin: 0, padding: 0 }),
                          valueContainer: (base) => ({ ...base, padding: '0 8px' }),
                        }}
                      />
                    );
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9.5px] font-black text-slate-700 uppercase tracking-wider">Primary Unit</label>
                <div className="flex bg-gray-200 p-0.5 rounded-lg border border-gray-300 h-[30px] items-center">
                  {[
                    { id: 'peti', label: 'Master Box' },
                    { id: 'tray', label: 'Inner Pack' },
                    { id: 'egg', label: 'Piece' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setValue('unitType', item.id)}
                      className={`flex-1 py-1 rounded text-[8.5px] font-black uppercase transition-all ${
                        unitType === item.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Pricing & Product Stock Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            
            {/* Pricing */}
            <div className="p-2.5 bg-[#f3f4f6] rounded-xl border border-gray-300 space-y-1.5 shadow-sm">
              <span className="text-[9.5px] font-black text-amber-700 uppercase tracking-wider block leading-none">
                Pricing (Rs.)
              </span>
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-amber-700 uppercase">Cost / {unitType === 'peti' ? 'Master Box' : unitType === 'tray' ? 'Inner Pack' : 'Piece'}</label>
                <input
                  type="number"
                  step="any"
                  {...register("costPrice")}
                  disabled={mode === "view"}
                  className="w-full bg-white border border-gray-300 rounded-lg py-1 px-2 text-xs font-black text-amber-700 outline-none focus:border-amber-600"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Product Stock Breakdown */}
            <div className="p-2.5 bg-[#f3f4f6] rounded-xl border border-gray-300 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-black uppercase text-teal-700 tracking-wider">Product Stock</span>
                <span className="text-[8px] font-bold text-slate-600 bg-gray-200 px-1.5 py-0.5 rounded border border-gray-300">1 Box=12 Pack=360 Piece</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[8px] font-black text-amber-700 uppercase block text-center mb-0.5">Box (360)</label>
                  <input
                    type="number"
                    step="any"
                    {...register("petiQuantity", {
                      onChange: (e) => {
                        const val = e.target.value;
                        if (val === '' || isNaN(Number(val))) {
                          setValue("trayQuantity", '');
                          setValue("eggQuantity", '');
                        } else {
                          const num = parseFloat(val);
                          const tPerP = parseFloat(watch("traysPerPeti")) || 12;
                          const ePerT = parseFloat(watch("eggsPerTray")) || 30;
                          setValue("trayQuantity", Number((num * tPerP).toFixed(1)));
                          setValue("eggQuantity", Math.round(num * tPerP * ePerT));
                        }
                      }
                    })}
                    disabled={mode === "view"}
                    className="w-full bg-white border border-amber-400 rounded-lg py-1 px-1 text-center text-xs font-black text-slate-900 outline-none focus:border-amber-600"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black text-teal-700 uppercase block text-center mb-0.5">Pack (12)</label>
                  <input
                    type="number"
                    step="any"
                    {...register("trayQuantity", {
                      onChange: (e) => {
                        const val = e.target.value;
                        if (val === '' || isNaN(Number(val))) {
                          setValue("petiQuantity", '');
                          setValue("eggQuantity", '');
                        } else {
                          const num = parseFloat(val);
                          const tPerP = parseFloat(watch("traysPerPeti")) || 12;
                          const ePerT = parseFloat(watch("eggsPerTray")) || 30;
                          setValue("petiQuantity", Number((num / tPerP).toFixed(2)));
                          setValue("eggQuantity", Math.round(num * ePerT));
                        }
                      }
                    })}
                    disabled={mode === "view"}
                    className="w-full bg-white border border-teal-400 rounded-lg py-1 px-1 text-center text-xs font-black text-slate-900 outline-none focus:border-teal-600"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black text-emerald-700 uppercase block text-center mb-0.5">Piece (1)</label>
                  <input
                    type="number"
                    step="any"
                    {...register("eggQuantity", {
                      onChange: (e) => {
                        const val = e.target.value;
                        if (val === '' || isNaN(Number(val))) {
                          setValue("petiQuantity", '');
                          setValue("trayQuantity", '');
                        } else {
                          const num = parseFloat(val);
                          const tPerP = parseFloat(watch("traysPerPeti")) || 12;
                          const ePerT = parseFloat(watch("eggsPerTray")) || 30;
                          const ePerP = tPerP * ePerT;
                          setValue("petiQuantity", Number((num / ePerP).toFixed(2)));
                          setValue("trayQuantity", Number((num / ePerT).toFixed(1)));
                        }
                      }
                    })}
                    disabled={mode === "view"}
                    className="w-full bg-white border border-emerald-400 rounded-lg py-1 px-1 text-center text-xs font-black text-slate-900 outline-none focus:border-emerald-600"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Row 3: Supplier & Payment Details */}
          <div className="p-2.5 bg-[#f3f4f6] rounded-xl border border-gray-300 space-y-2 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-300 pb-1.5">
              <span className="text-[9.5px] font-black uppercase text-teal-700 flex items-center gap-1.5 tracking-wider">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" /> Supplier &amp; Payment
              </span>
              
              {/* Payment Switcher */}
              <div className="flex items-center p-0.5 bg-gray-200 rounded-lg border border-gray-300">
                <button
                  type="button"
                  onClick={() => {
                    setValue("paymentMethod", "Cash");
                    setValue("isOnlinePayment", false);
                  }}
                  disabled={mode === "view"}
                  className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                    !isBankMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Banknote className="w-3 h-3" /> Cash
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue("paymentMethod", "Bank Transfer");
                    setValue("isOnlinePayment", true);
                  }}
                  disabled={mode === "view"}
                  className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                    isBankMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-3 h-3" /> Bank
                </button>
              </div>
            </div>

            {/* Supplier Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <div className="col-span-1">
                <Controller
                  name="supplierName"
                  control={control}
                  render={({ field }) => (
                    <CreatableSelect
                      {...field}
                      isClearable
                      isDisabled={mode === 'view'}
                      options={knownSuppliers.map(s => ({ value: s.name, label: s.name }))}
                      onChange={(val) => {
                        const sName = val ? val.value : "";
                        field.onChange(sName);
                        if (sName) {
                          const matched = knownSuppliers.find(s => s.name.toLowerCase() === sName.toLowerCase());
                          if (matched) {
                            if (matched.phone) setValue("supplierPhone", matched.phone);
                            if (matched.location) setValue("supplierLocation", matched.location);
                          }
                        }
                      }}
                      onCreateOption={(inputValue) => field.onChange(inputValue)}
                      value={field.value ? { label: field.value, value: field.value } : null}
                      placeholder="Select / Type Vendor..."
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          backgroundColor: '#ffffff',
                          borderRadius: "0.5rem",
                          minHeight: "30px",
                          height: "30px",
                          fontSize: "10.5px",
                          borderColor: state.isFocused ? '#0d9488' : '#d1d5db',
                          fontWeight: 'bold',
                          color: '#0f172a',
                          boxShadow: 'none'
                        }),
                        menu: (base) => ({
                          ...base,
                          backgroundColor: '#ffffff',
                          borderRadius: "0.5rem",
                          fontSize: "10.5px",
                          border: '1px solid #d1d5db',
                          zIndex: 99
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isFocused ? '#f0fdfa' : 'transparent',
                          color: state.isFocused ? '#0f766e' : '#0f172a',
                          fontSize: "10.5px"
                        }),
                        singleValue: (base) => ({ ...base, color: '#0f172a' }),
                        input: (base) => ({ ...base, color: '#0f172a', margin: 0, padding: 0 }),
                        valueContainer: (base) => ({ ...base, padding: '0 8px' }),
                      }}
                    />
                  )}
                />
              </div>
              <input
                type="text"
                {...register("supplierPhone")}
                disabled={mode === "view"}
                className="w-full bg-white border border-gray-300 rounded-lg py-1 px-2 text-[10.5px] font-bold text-slate-900 outline-none focus:border-teal-600 placeholder:text-gray-400 h-[30px]"
                placeholder="Phone (0300..)"
              />
              <input
                type="text"
                {...register("supplierLocation")}
                disabled={mode === "view"}
                className="w-full bg-white border border-gray-300 rounded-lg py-1 px-2 text-[10.5px] font-bold text-slate-900 outline-none focus:border-teal-600 placeholder:text-gray-400 h-[30px]"
                placeholder="Farm Location"
              />
            </div>

            {/* Paid Amount Input & Quick 100% Buttons */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className={`text-[9px] font-black uppercase shrink-0 ${isBankMode ? 'text-indigo-700' : 'text-emerald-700'}`}>
                {isBankMode ? 'Bank Paid:' : 'Cash Paid:'}
              </span>
              <input
                type="number"
                step="any"
                {...register("amountPaidToSupplier", {
                  onChange: () => setHasUserEditedPayment(true)
                })}
                disabled={mode === "view"}
                className={`flex-1 bg-white border rounded-lg py-1 px-2 text-xs font-black outline-none ${
                  isBankMode ? 'border-indigo-400 text-indigo-700 focus:border-indigo-600' : 'border-emerald-400 text-emerald-700 focus:border-emerald-600'
                }`}
                placeholder="0 if credit"
              />
              {calculatedTotalBill > 0 && mode !== "view" && (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setValue("amountPaidToSupplier", calculatedTotalBill);
                      setHasUserEditedPayment(true);
                    }}
                    className={`px-2 py-1 rounded-lg text-[8.5px] font-black border cursor-pointer ${
                      isBankMode ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    100% Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setValue("amountPaidToSupplier", 0);
                      setHasUserEditedPayment(true);
                    }}
                    className="px-2 py-1 rounded-lg bg-rose-100 text-rose-800 text-[8.5px] font-black border border-rose-300 cursor-pointer"
                  >
                    Credit
                  </button>
                </div>
              )}
            </div>

            {/* Bill Summary Banner */}
            <div className="grid grid-cols-3 gap-1 bg-gray-200 p-1.5 rounded-lg border border-gray-300 text-xs">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-600 uppercase">Total:</span>
                <span className="font-black text-slate-900 text-xs">Rs. {calculatedTotalBill.toLocaleString()}</span>
              </div>
              <div className="flex flex-col border-l border-gray-300 pl-1.5">
                <span className={`text-[8px] font-black uppercase ${isBankMode ? 'text-indigo-700' : 'text-emerald-700'}`}>
                  Paid:
                </span>
                <span className={`font-black text-xs ${isBankMode ? 'text-indigo-700' : 'text-emerald-700'}`}>
                  Rs. {watchedPaidNum.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col border-l border-gray-300 pl-1.5">
                <span className="text-[8px] font-black text-rose-600 uppercase">Due:</span>
                <span className={`font-black text-xs ${calculatedDue > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                  Rs. {calculatedDue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Row 4: Notes */}
          <div className="space-y-1">
            <input
              type="text"
              {...register("description")}
              disabled={mode === "view"}
              className="w-full bg-white border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] font-bold text-slate-900 outline-none focus:border-emerald-600 placeholder:text-gray-400"
              placeholder="Optional notes or details..."
            />
          </div>

        </form>

        {/* Modal Footer Actions */}
        <div className="p-2.5 px-4 border-t border-gray-300 bg-[#d1d5db] flex gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-1.5 px-3 bg-gray-300 hover:bg-gray-400 text-slate-800 rounded-lg font-black text-xs uppercase tracking-wider transition-all cursor-pointer border border-gray-400/50"
          >
            {mode === "view" ? "Close" : "Cancel"}
          </button>
          {mode !== "view" && (
            <button
              type="button"
              onClick={handleSubmit(onSubmit, (errs) => console.error('[Form Validation Error]', errs))}
              className="flex-[1.5] py-1.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer"
            >
              {mode === "add" ? "Create Product" : "Save Changes"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}