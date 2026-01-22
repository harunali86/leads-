
"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Phone, MapPin, Globe, Star, Plus, Search,
    ExternalLink, CheckCircle, XCircle, Info, Menu, X, LayoutGrid, List
} from 'lucide-react';
import dayjs from 'dayjs';

interface Lead {
    id: string;
    business_name: string;
    status: string;
    quality_score: number;
    phone: string | null;
    email: string | null;
    address: string | null;
    website: string | null;
    rating: number;
    review_count: number;
    google_maps_url: string;
    created_at: string;
    contacted: boolean;
}

export default function DashboardClient() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid'); // Default to grid for mobile
    const [searchTerm, setSearchTerm] = useState('');

    const [stats, setStats] = useState({ total: 0, qualified: 0, contacted: 0 });
    const [newLead, setNewLead] = useState({ name: '', phone: '', address: '' });

    useEffect(() => {
        fetchLeads();
        const channel = supabase
            .channel('realtime leads')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchLeads = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase Error:", error);
        }

        if (!error && data) {
            setLeads(data);
            setStats({
                total: data.length,
                qualified: data.filter(l => (l.quality_score || 0) > 60).length,
                contacted: data.filter(l => l.contacted).length
            });
        }
        setLoading(false);
    };

    const toggleContacted = async (id: string, current: boolean) => {
        await supabase.from('leads').update({ contacted: !current }).eq('id', id);
        setLeads(prev => prev.map(l => l.id === id ? { ...l, contacted: !current } : l));
        setStats(prev => ({ ...prev, contacted: prev.contacted + (current ? -1 : 1) }));
    };

    const getAnalysis = (lead: Lead) => {
        if (!lead.website && lead.rating >= 4.5 && lead.review_count > 50) return { tag: "The Invisible King", color: "bg-purple-500/20 text-purple-400", pitch: `Hi ${lead.business_name}, I saw you're one of the top-rated in the area (${lead.rating}⭐), but I couldn't find your website to see your services. You're losing high-value customers! I build premium sites for local leaders. Interested?` };
        if (!lead.website) return { tag: "No Website", color: "bg-emerald-500/20 text-emerald-400", pitch: `Hi ${lead.business_name}, noticed you don't have a website listed on Maps. We build affordable, high-converting landing pages starting at ₹4999. Can I send you a 1-minute demo?` };
        if (lead.rating < 4.2) return { tag: "Reputation Rescue", color: "bg-amber-500/20 text-amber-400", pitch: `Hi ${lead.business_name}, saw your Maps profile. You have great potential, but your current rating (${lead.rating}) might be scaring people away. I specialize in Reputation Management to push those bad reviews down. Chat?` };
        if (lead.review_count < 30) return { tag: "Growth Needed", color: "bg-blue-500/20 text-blue-400", pitch: `Hi ${lead.business_name}, your business looks great but you only have ${lead.review_count} reviews. Competitors with more reviews are winning. I can automate your review collection. Ready to grow?` };
        return { tag: "Optimization", color: "bg-slate-700 text-slate-300", pitch: `Hi ${lead.business_name}, loved your profile. I help successful businesses like yours optimize their digital funnel to get 2x more calls. Open to a 5-min audit?` };
    };

    const generatePitch = (lead: Lead) => getAnalysis(lead).pitch;

    const filteredLeads = leads.filter(l =>
        l.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.phone && l.phone.includes(searchTerm))
    );

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans pb-20">
            {/* Header / Stats */}
            <div className="sticky top-0 z-40 bg-[#0f172a]/80 backdrop-blur-md border-b border-white/5 p-4 md:p-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
                            <LayoutGrid className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight">LeadForge <span className="text-blue-500 text-sm font-mono font-normal">v2.0</span></h1>
                            <p className="text-slate-400 text-xs md:text-sm">Command Center</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 md:gap-4 w-full md:w-auto">
                        <StatItem label="Total" value={stats.total} color="text-blue-400" />
                        <StatItem label="Hot" value={stats.qualified} color="text-emerald-400" />
                        <StatItem label="Done" value={stats.contacted} color="text-purple-400" />
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="max-w-7xl mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search business or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <div className="bg-slate-800/50 p-1 rounded-lg border border-slate-700 hidden md:flex">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><LayoutGrid size={18} /></button>
                        <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><List size={18} /></button>
                    </div>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> Add Lead
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                {loading ? (
                    <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div></div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredLeads.map(lead => {
                                    const analysis = getAnalysis(lead);
                                    return <LeadCard key={lead.id} lead={lead} onToggle={() => toggleContacted(lead.id, lead.contacted)} pitch={analysis.pitch} analysis={analysis} />
                                })}
                            </div>
                        ) : (
                            <div className="bg-slate-800/30 border border-slate-700 rounded-2xl overflow-hidden hidden md:block">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-800/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-700">
                                        <tr>
                                            <th className="p-4">Business</th>
                                            <th className="p-4">Analysis</th>
                                            <th className="p-4">Rating</th>
                                            <th className="p-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {filteredLeads.map(lead => {
                                            const analysis = getAnalysis(lead);
                                            return <LeadRow key={lead.id} lead={lead} onToggle={() => toggleContacted(lead.id, lead.contacted)} pitch={analysis.pitch} analysis={analysis} />
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {filteredLeads.length === 0 && <p className="text-center text-slate-500 mt-20">No matching leads found.</p>}
                    </>
                )}
            </div>

            {/* Modals */}
            {showAddForm && <AddLeadModal onClose={() => setShowAddForm(false)} onSave={fetchLeads} />}
        </div>
    );
}

function LeadCard({ lead, onToggle, pitch, analysis }: { lead: Lead, onToggle: () => void, pitch: string, analysis: { tag: string, color: string } }) {
    const [copied, setCopied] = useState(false);

    const copyPitch = () => {
        navigator.clipboard.writeText(pitch);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`group relative bg-slate-800/40 border border-slate-700 rounded-2xl p-5 hover:border-blue-500/50 transition-all ${lead.contacted ? 'opacity-60 grayscale-[0.5]' : ''}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded w-fit ${analysis.color}`}>
                        {analysis.tag}
                    </span>
                    <h3 className="font-bold text-slate-100 line-clamp-1 group-hover:text-blue-400 transition-colors" title={lead.business_name}>{lead.business_name}</h3>
                </div>
                <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-lg text-xs font-bold">
                    <Star className="w-3 h-3 fill-current" /> {lead.rating}
                </div>
            </div>

            <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-500 shrink-0" />
                    <span className="line-clamp-2">{lead.address || "Address not fully captured"}</span>
                </div>
                <div className="flex items-center gap-3">
                    {lead.phone ? (
                        <div className="flex items-center gap-2 text-xs text-blue-400 font-mono font-bold bg-blue-500/10 px-2 py-1 rounded">
                            <Phone className="w-3 h-3" /> {lead.phone}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-xs text-slate-500 italic bg-slate-700/30 px-2 py-1 rounded">
                            <Info className="w-3 h-3" /> Phone Missing
                        </div>
                    )}
                    <a
                        href={lead.google_maps_url}
                        target="_blank"
                        title="View on Google Maps"
                        className="p-1 px-2 rounded bg-slate-700/50 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"
                    >
                        <Globe className="w-3 h-3" /> Source
                    </a>
                </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                <div className="flex gap-2">
                    <button
                        onClick={onToggle}
                        title={lead.contacted ? "Mark as New" : "Mark as Contacted"}
                        className={`flex-1 flex justify-center py-2.5 rounded-xl transition-all border
                            ${lead.contacted ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'}
                        `}
                    >
                        {lead.contacted ? <XCircle size={18} /> : <CheckCircle size={18} />}
                    </button>
                    <button
                        onClick={copyPitch}
                        title="Copy Pitch Message"
                        className="flex-1 flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl transition-all text-[10px] font-bold uppercase"
                    >
                        {copied ? "Copied!" : "Pitch Text"}
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    {lead.phone ? (
                        <a
                            href={`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(pitch)}`}
                            target="_blank"
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-900/20 text-sm active:scale-95 transition-all"
                        >
                            <ExternalLink size={14} /> WhatsApp Pitch
                        </a>
                    ) : null}

                    {lead.email ? (
                        <a
                            href={`mailto:${lead.email}?subject=Business Inquiry&body=${encodeURIComponent(pitch)}`}
                            target="_blank"
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 text-sm active:scale-95 transition-all"
                        >
                            <Search size={14} /> Email Pitch
                        </a>
                    ) : null}

                    {!lead.phone && !lead.email && (
                        <a
                            href={lead.google_maps_url}
                            target="_blank"
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 text-sm active:scale-95 transition-all"
                        >
                            <Search size={14} /> Search Contact Info 🔎
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

function LeadRow({ lead, onToggle, pitch, analysis }: { lead: Lead, onToggle: () => void, pitch: string, analysis: { tag: string, color: string } }) {
    return (
        <tr className={`hover:bg-slate-800/40 transition-colors ${lead.contacted ? 'opacity-40' : ''}`}>
            <td className="p-4">
                <div className="font-bold text-sm text-slate-200">{lead.business_name}</div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 shrink-0"><MapPin size={10} /> <span className="truncate max-w-[200px]">{lead.address}</span></div>
            </td>
            <td className="p-4">
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${analysis.color}`}>
                    {analysis.tag}
                </span>
            </td>
            <td className="p-4 text-xs font-mono">
                {lead.phone ? <span className="text-blue-400">{lead.phone}</span> : <span className="text-slate-500 italic">None</span>}
            </td>
            <td className="p-4">
                <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold"><Star size={12} fill="currentColor" /> {lead.rating} <span className="text-slate-500 font-normal">({lead.review_count})</span></div>
            </td>
            <td className="p-4 text-right">
                <div className="flex justify-end gap-2">
                    <a href={lead.google_maps_url} target="_blank" className="p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-500" title="Source"><Globe size={16} /></a>
                    <button onClick={onToggle} className="p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-500">{lead.contacted ? <XCircle size={16} /> : <CheckCircle size={16} />}</button>
                    {lead.phone && (
                        <a
                            href={`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(pitch)}`}
                            target="_blank"
                            className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-emerald-500/20"
                        >
                            WhatsApp
                        </a>
                    )}
                </div>
            </td>
        </tr>
    );
}

function StatItem({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="bg-slate-800/40 border border-slate-700 p-2 md:p-3 rounded-xl text-center">
            <div className={`text-sm md:text-lg font-bold ${color}`}>{value}</div>
            <div className="text-[8px] md:text-[10px] text-slate-500 uppercase font-bold tracking-widest">{label}</div>
        </div>
    );
}

function AddLeadModal({ onClose, onSave }: { onClose: () => void, onSave: () => void }) {
    const [form, setForm] = useState({ name: '', phone: '', address: '' });
    const handleSubmit = async (e: any) => {
        e.preventDefault();
        const { error } = await supabase.from('leads').insert({
            id: btoa(form.name + Date.now()),
            business_name: form.name,
            phone: form.phone,
            address: form.address,
            status: 'MANUAL',
            quality_score: 50
        });
        if (!error) { onSave(); onClose(); }
    };
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">New Manual Lead</h2>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input required placeholder="Business Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-800 border-slate-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <input placeholder="Phone Number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full bg-slate-800 border-slate-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <input placeholder="City / Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full bg-slate-800 border-slate-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="submit" className="w-full bg-blue-600 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all mt-4">Save Lead</button>
                </form>
            </div>
        </div>
    );
}
