import { useParams, useNavigate } from 'react-router-dom';
import { useProducts } from '../contexts/ProductContext';
import { useUser } from '../contexts/UserContext';
import { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingCart, Package, Calendar, Tag, Info, Image as ImageIcon, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { getImageUrl } from '../utils/imageHelper';

export function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { products, getStockStatus, addToCart, loading } = useProducts();
    const { isCustomer } = useUser();
    const [product, setProduct] = useState(null);
    const [selectedImage, setSelectedImage] = useState(0);

    useEffect(() => {
        if (products.length > 0) {
            const found = products.find(p => p._id === id);
            setProduct(found || null);
        }
    }, [id, products]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
        );
    }

    if (!product && !loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 min-h-[60vh]">
                <h2 className="text-2xl font-black uppercase text-[var(--color-text-primary)]">Product Not Found</h2>
                <button onClick={() => navigate(-1)} className="mt-4 px-6 py-2 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl uppercase font-black text-[10px] tracking-widest text-[var(--color-text-primary)] hover:text-green-500">
                    Go Back
                </button>
            </div>
        );
    }

    if (!product) return null;

    const status = getStockStatus(product.stock, product.minStock);
    const images = product.images?.length > 0 ? product.images : [];

    return (
        <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-8 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors group">
                <div className="p-2 bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)] rounded-xl group-hover:scale-105 transition-transform">
                    <ArrowLeft className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Back to Catalog</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Gallery Section */}
                <div className="space-y-4">
                    <div className="relative aspect-square w-full bg-[var(--color-surface-card)] rounded-[2.5rem] border border-[var(--color-border-subtle)] overflow-hidden flex items-center justify-center p-8 shadow-2xl">
                        {images.length > 0 ? (
                            <motion.img
                                key={selectedImage}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                                src={getImageUrl(images[selectedImage])}
                                alt={product.name}
                                onError={(e) => { e.target.onerror = null; e.target.src = '/egg2.png'; }}
                                className="w-full h-full object-contain drop-shadow-xl"
                            />
                        ) : (
                            <div className="flex flex-col items-center opacity-20">
                                <ImageIcon className="w-20 h-20 mb-4" />
                                <span className="text-xs font-black uppercase tracking-widest">No Image Available</span>
                            </div>
                        )}

                        {/* Status Badge Overlays */}
                        <div className="absolute top-6 left-6">
                            {product.stock > 0 && product.stock <= product.minStock ? (
                                <div className="bg-amber-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                                    Low Stock
                                </div>
                            ) : product.stock === 0 ? (
                                <div className="bg-rose-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                                    Out of Stock
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* Thumbnails */}
                    {images.length > 1 && (
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide py-2">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedImage(idx)}
                                    className={`relative w-24 h-24 shrink-0 rounded-2xl bg-[var(--color-surface-card)] border-2 transition-all overflow-hidden ${selectedImage === idx ? 'border-[var(--color-primary)] shadow-[0_0_20px_rgba(37,99,235,0.2)] scale-105' : 'border-[var(--color-border-subtle)] opacity-50 hover:opacity-100 hover:scale-105'}`}
                                >
                                    <img 
                                        src={getImageUrl(img)} 
                                        onError={(e) => { e.target.onerror = null; e.target.src = '/egg2.png'; }}
                                        className="w-full h-full object-cover" 
                                        alt="thumbnail" 
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info Section */}
                <div className="flex flex-col space-y-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)] text-[10px] font-black text-[var(--color-primary)] uppercase tracking-widest">
                            <Tag className="w-3 h-3" />
                            {product.category || 'Uncategorized'}
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter leading-none">
                            {product.name}
                        </h1>
                        <div className="text-5xl font-black text-[var(--color-primary)] tracking-tighter tabular-nums mt-4">
                            <span className="text-2xl top-[-1rem] relative opacity-50">Rs.</span>
                            {product.price.toLocaleString()}
                        </div>
                    </div>

                    <p className="text-sm text-[var(--color-text-primary)]/70 font-semibold leading-relaxed max-w-2xl">
                        {product.description || "No specific details provided for this product. Check metadata for handling requirements."}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col p-6 bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)] rounded-3xl">
                            <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-2 mb-1">
                                <Package className="w-4 h-4" /> Available Stock
                            </span>
                            <span className="text-3xl font-black tracking-tighter text-[var(--color-text-primary)]">
                                {product.stock} <span className="text-sm">pcs</span>
                            </span>
                        </div>

                        <div className="flex flex-col p-6 bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)] rounded-3xl">
                            <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-2 mb-1">
                                <Calendar className="w-4 h-4" /> Expiry Registry
                            </span>
                            <span className={`text-xl font-black tracking-tighter mt-1 ${product.expiryDate && new Date(product.expiryDate) < new Date() ? 'text-rose-500' : 'text-[var(--color-text-primary)]'}`}>
                                {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : 'N/A'}
                            </span>
                        </div>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1"></div>

                    {/* Action Base */}
                    {isCustomer() && (
                        <div className="pt-6 border-t border-[var(--color-border-subtle)] flex flex-col gap-4">
                            <button
                                onClick={() => {
                                    if (product.stock > 0) {
                                        addToCart(product);
                                    }
                                }}
                                disabled={product.stock <= 0}
                                className={`w-full py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3
                    ${product.stock > 0
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_10px_40px_-10px_rgba(37,99,235,0.5)] hover:scale-[1.02] active:scale-[0.98]'
                                        : 'bg-red-600/90 border border-red-500 text-white cursor-not-allowed opacity-90 shadow-sm'}`}
                            >
                                {product.stock > 0 ? (
                                    <><ShoppingCart className="w-5 h-5" /> Add to Active Cart</>
                                ) : (
                                    <><Lock className="w-5 h-5" /> Out of Stock (Locked)</>
                                )}
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
