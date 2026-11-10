import React, { useState } from 'react';
import { X, CreditCard, Wallet, Truck, CheckCircle, Loader2, Copy, Check, Upload, Image as ImageIcon, QrCode, PhoneCall, Zap, ShieldCheck } from 'lucide-react';
import { useCustomerAuth } from '../contexts/CustomerAuthContext.jsx';

export function CheckoutModal({ isOpen, onClose, totalAmount, currency }) {
  const displayCurrency = (!currency || currency === '$') ? 'Rs.' : currency;
  const { cart, customer, authHeader, clearCart } = useCustomerAuth();

  const [step, setStep] = useState(1); // 1 = Details, 2 = Payment, 3 = Success, 4 = EasyPaisa Direct Transfer
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [shippingDetails, setShippingDetails] = useState({
    fullName: customer?.fullName || '',
    phone: '',
    address: '',
    city: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('COD'); // COD, STRIPE, EASYPAISA

  const [easyPaisaData, setEasyPaisaData] = useState(null);
  const [txRef, setTxRef] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [verificationStage, setVerificationStage] = useState(''); // '', 'verifying', 'done'

  const [payMode, setPayMode] = useState('qr'); // 'qr' or 'number'
  const [paymentProof, setPaymentProof] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  if (!isOpen) return null;

  const superAdminNum = easyPaisaData?.superAdminNumber || '03489273035';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=EasyPaisa:${superAdminNum}`;

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(superAdminNum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('images', file);
      const res = await fetch('/api/upload/public', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to upload screenshot');
      setPaymentProof(data.images[0]);
    } catch (err) {
      setError(err.message || 'Screenshot upload failed');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleConfirmEasyPaisa = async () => {
    if (!easyPaisaData?.orderId) return;
    setConfirming(true);
    setVerificationStage('verifying');
    setError('');

    try {
      // Simulate 1.2s instant gateway response
      await new Promise(r => setTimeout(r, 1200));

      const res = await fetch(`/api/checkout/confirm/${easyPaisaData.orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ transactionId: txRef, paymentProof })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to confirm payment');

      setVerificationStage('done');
      await new Promise(r => setTimeout(r, 600));
      clearCart();
      setStep(3); // Success Screen
    } catch (err) {
      setError(err.message || 'Failed to confirm payment');
      setVerificationStage('');
    } finally {
      setConfirming(false);
    }
  };

  const handleProcessCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ 
          paymentMethod, 
          shippingDetails,
          items: cart,
          shopId: customer?.shopId || ''
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      if (paymentMethod === 'COD') {
        clearCart();
        setStep(3); // Success Screen
      }
      else if (paymentMethod === 'STRIPE') {
        // Redirect to Stripe Hosted Checkout
        window.location.href = data.url;
      }
      else if (paymentMethod === 'EASYPAISA') {
        setEasyPaisaData(data.easyPaisaData);
        setStep(4);
      }
    } catch (err) {
      setError(err.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const isDetailsValid = shippingDetails.fullName && shippingDetails.phone && shippingDetails.address && shippingDetails.city;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div
        className="bg-[#1E293B] border border-slate-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative text-white animate-in zoom-in-95 duration-300 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60 bg-[#15202B] sticky top-0 z-10">
          <h2 className="text-xl font-black uppercase tracking-tight">Checkout</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold text-center">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in slide-in-from-right">
              <h3 className="text-emerald-400 text-xs font-black uppercase tracking-widest">1. Shipping Details</h3>
              <input type="text" placeholder="Full Name" value={shippingDetails.fullName} onChange={e => setShippingDetails({ ...shippingDetails, fullName: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-emerald-500" />
              <input type="text" placeholder="Phone Number" value={shippingDetails.phone} onChange={e => setShippingDetails({ ...shippingDetails, phone: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-emerald-500" />
              <input type="text" placeholder="Address" value={shippingDetails.address} onChange={e => setShippingDetails({ ...shippingDetails, address: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-emerald-500" />
              <input type="text" placeholder="City" value={shippingDetails.city} onChange={e => setShippingDetails({ ...shippingDetails, city: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-emerald-500" />

              {/* Multiple Products Summary Card */}
              {Array.isArray(cart) && cart.length > 0 && (
                <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 space-y-2.5 shadow-inner">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <span>Order Items ({cart.length} Products)</span>
                    <span className="text-emerald-400 font-bold">{cart.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} Total Units</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                        <span className="font-bold text-slate-200 truncate max-w-[220px]">
                          {item.name} <span className="text-[10px] text-amber-300 font-mono">x{item.quantity}</span>
                        </span>
                        <span className="font-mono font-black text-emerald-400 text-xs">
                          {displayCurrency} {((Number(item.price) || 0) * (Number(item.quantity) || 1)).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setStep(2)}
                disabled={!isDetailsValid}
                className="w-full py-4 mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs uppercase tracking-[0.1em] transition-all cursor-pointer shadow-lg active:scale-98"
              >
                Continue to Payment
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in slide-in-from-right">
              <div className="flex items-center justify-between">
                <h3 className="text-emerald-400 text-xs font-black uppercase tracking-widest">2. Payment Method</h3>
                <span className="text-xl font-black">{displayCurrency} {totalAmount.toLocaleString()}</span>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setPaymentMethod('COD')}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'COD' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
                >
                  <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400"><Truck className="w-5 h-5" /></div>
                  <div className="text-left flex-1"><p className="font-bold">Cash on Delivery</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">Pay when you receive</p></div>
                </button>

                <button
                  onClick={() => setPaymentMethod('STRIPE')}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'STRIPE' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
                >
                  <div className="p-2 bg-indigo-500/20 rounded-full text-indigo-400"><CreditCard className="w-5 h-5" /></div>
                  <div className="text-left flex-1"><p className="font-bold">Bank Card (Stripe)</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">Secure card payment</p></div>
                </button>

                <button
                  onClick={() => setPaymentMethod('EASYPAISA')}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'EASYPAISA' ? 'border-green-500 bg-green-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
                >
                  <div className="p-2 bg-green-500/20 rounded-full text-green-400"><Wallet className="w-5 h-5" /></div>
                  <div className="text-left flex-1"><p className="font-bold">EasyPaisa</p><p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Instant Real-Time Transfer & Scan</p></div>
                </button>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-700/60">
                <button onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs uppercase tracking-[0.1em]">Back</button>
                <button
                  onClick={handleProcessCheckout}
                  disabled={loading}
                  className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : 'Complete Order'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-6 text-center flex flex-col items-center animate-in zoom-in-95">
              <div className="p-4 bg-emerald-500/20 rounded-full mb-4">
                <CheckCircle className="w-16 h-16 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black uppercase italic mb-2">Order Confirmed!</h2>
              <p className="text-slate-400 font-medium text-sm mb-4 max-w-xs">Your order has been placed successfully. You will receive it shortly.</p>

              {paymentProof && (
                <div className="mb-6 w-full max-w-xs p-3 bg-slate-900 border border-slate-700 rounded-2xl text-left space-y-2">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Uploaded Payment Screenshot Proof:</span>
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-black/40">
                    <img src={paymentProof} alt="Payment Proof" className="w-full h-40 object-cover hover:object-contain transition-all" />
                  </div>
                </div>
              )}

              <button onClick={onClose} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs uppercase tracking-[0.1em]">
                Continue Shopping
              </button>
            </div>
          )}

          {step === 4 && easyPaisaData && (
            <div className="space-y-4 animate-in slide-in-from-right text-left">
              {/* Top Banner */}
              <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border border-emerald-500/40 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase text-emerald-400 flex items-center gap-1.5">
                      EasyPaisa Instant Payment
                      <span className="px-2 py-0.5 bg-emerald-500 text-black text-[9px] font-black rounded-full uppercase">Real-Time</span>
                    </h3>
                    <p className="text-[11px] text-slate-300">Scan QR Code or send money to SuperAdmin account</p>
                  </div>
                </div>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-700/80">
                <button
                  onClick={() => setPayMode('qr')}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${payMode === 'qr' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <QrCode className="w-4 h-4" /> Scan EasyPaisa QR
                </button>
                <button
                  onClick={() => setPayMode('number')}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${payMode === 'number' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <PhoneCall className="w-4 h-4" /> EasyPaisa Number
                </button>
              </div>

              {/* QR Code Section */}
              {payMode === 'qr' && (
                <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
                  <div className="p-3 bg-white rounded-2xl border-4 border-emerald-500 shadow-2xl relative group">
                    <img src={qrCodeUrl} alt="EasyPaisa QR Code" className="w-44 h-44 object-contain" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold transition-all rounded-xl">
                      Open EasyPaisa App & Scan
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Amount: {displayCurrency} {easyPaisaData.transactionAmount?.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Scan this QR directly using your EasyPaisa Mobile App</p>
                  </div>
                </div>
              )}

              {/* Phone Number Section */}
              {payMode === 'number' && (
                <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase">Amount to Send:</span>
                    <span className="text-lg font-black text-emerald-400">{displayCurrency} {easyPaisaData.transactionAmount?.toLocaleString()}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SuperAdmin EasyPaisa Number:</span>
                    <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
                      <span className="text-lg font-black tracking-widest text-white">{superAdminNum}</span>
                      <button
                        onClick={handleCopyNumber}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-md active:scale-95"
                      >
                        {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-xs">
                    <span className="text-slate-400 font-bold">Account Title:</span>
                    <span className="font-bold text-slate-200">{easyPaisaData.accountTitle || 'Rizwan'}</span>
                  </div>
                </div>
              )}

              {/* Upload Screenshot Section */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Upload Transaction Screenshot (Proof):</span>
                  {uploadingProof && <span className="text-emerald-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>}
                </label>

                {paymentProof ? (
                  <div className="relative bg-slate-900 border border-emerald-500/50 rounded-2xl p-2.5 flex items-center gap-3">
                    <img src={paymentProof} alt="Proof preview" className="w-14 h-14 object-cover rounded-xl border border-slate-700" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Screenshot Attached!
                      </p>
                      <p className="text-[10px] text-slate-400">Proof ready for SuperAdmin verification.</p>
                    </div>
                    <button onClick={() => setPaymentProof('')} className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-bold">
                      Change
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-900/60 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-900">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-300">Click to upload EasyPaisa Receipt / Screenshot</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, WEBP screenshot of successful transfer</span>
                    <input type="file" accept="image/*" onChange={handleProofUpload} className="hidden" />
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Sender Phone / Transaction ID (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. 03xx-xxxxxxx or TRX ID"
                  value={txRef}
                  onChange={e => setTxRef(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action Button */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)} className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs uppercase tracking-[0.1em]">Back</button>
                <button
                  onClick={handleConfirmEasyPaisa}
                  disabled={confirming || uploadingProof}
                  className="flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                >
                  {confirming ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {verificationStage === 'verifying' ? 'Verifying Gateway...' : 'Instant Verification Completed!'}</>
                  ) : (
                    <><Zap className="w-4 h-4 text-yellow-300" /> Submit & Instant Verify</>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}


