import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { Building2, Plus, Trash2 } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';

export function VendorDirectory() {
  const { user } = useUser();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', location: '' });

  const shopId = user?.shopId || 1;

  const fetchVendors = async () => {
    try {
      const res = await api.get(`/vendors/${shopId}/full`);
      setVendors(res.data);
    } catch (error) {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [shopId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/vendors/${shopId}`, formData);
      toast.success('Vendor added!');
      setFormData({ name: '', phone: '', location: '' });
      setShowForm(false);
      fetchVendors();
    } catch (error) {
      toast.error('Failed to add vendor');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this vendor?')) return;
    try {
      await api.delete(`/vendors/${shopId}/${id}`);
      toast.success('Vendor removed!');
      fetchVendors();
    } catch (error) {
      toast.error('Failed to remove vendor');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <Building2 className="w-8 h-8 text-green-600" /> Vendor Directory
        </h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold">
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-[var(--color-surface-card)] p-6 rounded-2xl border shadow-sm space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase">Vendor Name *</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field mt-1 w-full" placeholder="e.g. Ali Poultry Farm" />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase">Phone</label>
            <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input-field mt-1 w-full" placeholder="03xx-xxxxxxx" />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase">Location</label>
            <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="input-field mt-1 w-full" placeholder="e.g. Lahore" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2 rounded-xl text-sm font-bold">Cancel</button>
            <button type="submit" className="btn-primary px-4 py-2 rounded-xl text-sm font-bold">Save Vendor</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vendors.map(vendor => (
          <div key={vendor.id} className="bg-[var(--color-surface-card)] p-5 rounded-2xl border shadow-sm flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg">{vendor.name}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">{vendor.phone || 'No phone'}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{vendor.location || 'No location'}</p>
            </div>
            <button onClick={() => handleDelete(vendor.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
        {vendors.length === 0 && !showForm && (
          <p className="text-[var(--color-text-secondary)] col-span-2 text-center py-8">No vendors added yet. Click "Add Vendor" to start.</p>
        )}
      </div>
    </div>
  );
}
