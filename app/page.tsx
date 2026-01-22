
"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Phone, MapPin, Globe, Star, Plus, Search,
  ExternalLink, Trash2, CheckCircle, XCircle
} from 'lucide-react';
import dayjs from 'dayjs';

interface Lead {
  id: string;
  business_name: string;
  status: string;
  quality_score: number;
  phone: string | null;
  address: string | null;
  website: string | null;
  rating: number;
  review_count: number;
  google_maps_url: string;
  created_at: string;
  notes: any;
  contacted: boolean;
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, qualified: 0, contacted: 0 });

  // New Lead Form State
  const [newLead, setNewLead] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    fetchLeads();
    // Subscribe to realtime changes
    const channel = supabase
      .channel('realtime leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLeads(data);
      // Calc Stats
      setStats({
        total: data.length,
        qualified: data.filter(l => l.quality_score > 60).length,
        contacted: data.filter(l => l.contacted).length
      });
    }
    setLoading(false);
  };

  const toggleContacted = async (id: string, current: boolean) => {
    await supabase.from('leads').update({ contacted: !current }).eq('id', id);
    // Optimistic update
    setLeads(leads.map(l => l.id === id ? { ...l, contacted: !current } : l));
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = btoa(newLead.name + Date.now()); // Simple ID gen
    const { error } = await supabase.from('leads').insert({
      id,
      business_name: newLead.name,
      phone: newLead.phone,
      address: newLead.address,
      status: 'MANUAL',
      quality_score: 50,
      created_at: new Date().toISOString()
    });

    if (!error) {
      setShowAddForm(false);
      setNewLead({ name: '', phone: '', address: '' });
      fetchLeads();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
            LeadForge Command Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">Real-time Acquisition Pipeline</p>
        </div>

        <div className="flex gap-4">
          <StatCard label="Total Leads" value={stats.total} color="bg-blue-500/20 text-blue-400" />
          <StatCard label="Qualified" value={stats.qualified} color="bg-emerald-500/20 text-emerald-400" />
          <StatCard label="Contacted" value={stats.contacted} color="bg-purple-500/20 text-purple-400" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="max-w-7xl mx-auto mb-6 flex justify-between items-center">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search leads..."
            className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" /> Add Manual Lead
        </button>
      </div>

      {/* Main Table */}
      <div className="max-w-7xl mx-auto bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Status / Score</th>
                <th className="p-4 font-semibold">Business</th>
                <th className="p-4 font-semibold">Contact Info</th>
                <th className="p-4 font-semibold">Context</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {leads.map((lead) => (
                <tr key={lead.id} className={`hover:bg-slate-800/80 transition-colors ${lead.contacted ? 'opacity-50 grayscale' : ''}`}>
                  {/* Status & Score */}
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit
                        ${lead.quality_score > 70 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'}
                      `}>
                        {lead.status || 'NEW'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">Score: {lead.quality_score}</span>
                    </div>
                  </td>

                  {/* Business Name */}
                  <td className="p-4">
                    <div className="font-medium text-slate-200">{lead.business_name}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                      <MapPin className="w-3 h-3" /> {truncate(lead.address, 30)}
                    </div>
                  </td>

                  {/* Contact Info */}
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm">
                          <Phone className="w-3 h-3" /> {lead.phone}
                        </a>
                      ) : (
                        <span className="text-slate-600 text-xs italic">No Phone</span>
                      )}

                      {lead.website && (
                        <a href={lead.website} target="_blank" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs">
                          <Globe className="w-3 h-3" /> Website
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Context (Rating) */}
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-yellow-500/80 text-sm">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{lead.rating}</span>
                      <span className="text-slate-600 text-xs">({lead.review_count})</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {dayjs(lead.created_at).format('MMM D, HH:mm')}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="p-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button
                        onClick={() => toggleContacted(lead.id, lead.contacted)}
                        className={`p-2 rounded-lg transition-all ${lead.contacted
                            ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            : 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-500/20'
                          }`}
                        title={lead.contacted ? "Mark as Pending" : "Mark as Contacted"}
                      >
                        {lead.contacted ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>

                      {lead.phone && (
                        <a
                          href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                          title="WhatsApp"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {leads.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    No leads found. Start the hunter script!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Add New Lead</h2>
            <form onSubmit={handleAddLead} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Business Name</label>
                <input
                  required
                  value={newLead.name}
                  onChange={e => setNewLead({ ...newLead, name: e.target.value })}
                  className="w-full bg-slate-800 border-slate-700 rounded p-2 text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                <input
                  value={newLead.phone}
                  onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                  className="w-full bg-slate-800 border-slate-700 rounded p-2 text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Address/City</label>
                <input
                  value={newLead.address}
                  onChange={e => setNewLead({ ...newLead, address: e.target.value })}
                  className="w-full bg-slate-800 border-slate-700 rounded p-2 text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium">Save Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className={`px-4 py-2 rounded-lg border border-white/5 ${color} flex items-center gap-3`}>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs uppercase tracking-wide opacity-80">{label}</span>
    </div>
  )
}

function truncate(str: string | null, n: number) {
  return (str?.length || 0) > n ? str?.substr(0, n - 1) + "..." : str;
}
