
"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Phone, MapPin, Globe, Star, Plus, Search,
    ExternalLink, CheckCircle, XCircle, Info, Menu, X, LayoutGrid, List,
    Mail, UserPlus, Copy, Map, Newspaper, MessageCircle, DollarSign, Send, Trash2, Target, Award, Crown, Stethoscope, Pin, Check
} from 'lucide-react';
import dayjs from 'dayjs';

interface Lead {
    id: string;
    business_name: string;
    status: string;
    quality_score: number;
    phone: string | null;
    phone_type: 'MOBILE' | 'LANDLINE' | null;
    email: string | null;
    instagram: string | null;
    facebook: string | null;
    address: string | null;
    website: string | null;
    rating: number;
    review_count: number;
    google_maps_url: string;
    created_at: string;
    contacted: boolean; // This will be replaced by 'status'
    is_premium?: boolean;
    source?: string;
    contact_name?: string | null;
    notes?: string | null;
}

const isWhatsAppCapable = (lead: Lead) => {
    if (!lead.phone) return false;
    // Reject placeholder text like SEARCH_REQUIRED
    if (lead.phone.includes('SEARCH') || lead.phone.includes('REQUIRED') || lead.phone.includes('N/A')) return false;
    const clean = lead.phone.replace(/\D/g, '');
    // Must have at least 10 digits to be a valid phone
    return clean.length >= 10;
};

// Helper to format phone for WhatsApp (auto-prefix 91 for Indian 10-digit numbers)
const formatPhoneForWhatsApp = (phone: string): string => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) return '91' + clean;
    return clean;
};

// Source types for tab filtering
type SourceTab = 'ALL' | 'MONEY_HUNT' | 'JAN_25' | 'JAN_25_2' | 'JAN_25_3' | 'JAN_25_4' | 'JAN_26' | 'GOOGLE_MAPS' | 'GULF' | 'HACKER_NEWS' | 'REDDIT' | 'FUNDED';

const SOURCE_TABS: { key: SourceTab; label: string; icon: any; color: string }[] = [
    { key: 'JAN_26', label: '26 (Instant)', icon: Award, color: 'violet' },
    { key: 'MONEY_HUNT', label: 'Money Hunt', icon: Send, color: 'emerald' },
    { key: 'JAN_25', label: '25 Jan', icon: Target, color: 'rose' },
    { key: 'JAN_25_2', label: 'Quality 200', icon: Award, color: 'amber' },
    { key: 'JAN_25_3', label: 'Elite Fresh', icon: Crown, color: 'purple' },
    { key: 'JAN_25_4', label: 'Medical Match', icon: Stethoscope, color: 'cyan' },
    { key: 'ALL', label: 'All', icon: LayoutGrid, color: 'blue' },
    { key: 'GULF', label: 'Gulf', icon: Globe, color: 'purple' },
    { key: 'GOOGLE_MAPS', label: 'Maps', icon: Map, color: 'emerald' },
    { key: 'HACKER_NEWS', label: 'HN', icon: Newspaper, color: 'orange' },
    { key: 'REDDIT', label: 'Reddit', icon: MessageCircle, color: 'red' },
    { key: 'FUNDED', label: 'Funded', icon: DollarSign, color: 'cyan' },
];

// Helper to parse notes correctly
const parseNotes = (lead: Lead) => {
    try { return lead.notes ? JSON.parse(lead.notes) : {}; } catch (e) { return {}; }
};

const getLeadSource = (lead: Lead): string => {
    const notes = parseNotes(lead);
    const source = notes.source || lead.source;

    if (source === 'INDEED_GULF_HUNT' || source === 'LINKEDIN_AUTH_SNIPE' || source === 'CENTURION_GULF_HUNT') return 'MONEY_HUNT';
    if (notes.market === 'MIDDLE_EAST') return 'GULF';
    if (lead.source === 'JAN_25_4') return 'JAN_25_4';
    if (lead.source === 'JAN_25_3') return 'JAN_25_3';
    if (lead.source === 'JAN_26') return 'JAN_26';
    if (lead.source === 'GULF_SNIPER') return 'GULF';
    if (lead.source) return lead.source;
    if (lead.business_name?.startsWith('[HN]')) return 'HACKER_NEWS';
    if (lead.business_name?.startsWith('[Reddit]')) return 'REDDIT';
    if (lead.business_name?.startsWith('[FUNDED]')) return 'VERIFIED_FUNDING';

    // 25 JAN SNIPER LOGIC (High Ticket + Established)
    const name = lead.business_name.toLowerCase();
    const highTicketKeywords = ['luxury', 'premium', 'diamond', 'gold', 'jewel', 'realty', 'estate', 'robotic', 'implant', 'architect', 'villa', 'residency', 'heights', 'developer', 'associate', 'international', 'wedding', 'event', 'clinic', 'fitness', 'gym', 'skin', 'derma', 'dental'];

    const isEstablished = (lead.review_count || 0) >= 100;
    const isHighValue = highTicketKeywords.some(w => name.includes(w)) || (lead.rating || 0) >= 4.7;

    if (!lead.website && lead.phone && isEstablished && isHighValue) {
        return 'JAN_25';
    }

    // JAN 25.2 (QUALITY 200)
    if (!lead.website && lead.phone && (lead.review_count || 0) >= 70 && (lead.rating || 0) >= 4.7) {
        return 'JAN_25_2';
    }

    if (lead.google_maps_url?.includes('google.com/maps')) return 'GOOGLE_MAPS';
    return 'UNKNOWN';
};

export default function DashboardClient() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [showPremiumOnly, setShowPremiumOnly] = useState(false);
    const [activeTab, setActiveTab] = useState<SourceTab>('ALL');
    const [stats, setStats] = useState({ total: 0, qualified: 0, contacted: 0, premium: 0, aukat: 0 });
    const [sourceCounts, setSourceCounts] = useState<Record<SourceTab, number>>({ ALL: 0, MONEY_HUNT: 0, JAN_25: 0, JAN_25_2: 0, JAN_25_3: 0, JAN_25_4: 0, JAN_26: 0, GOOGLE_MAPS: 0, GULF: 0, HACKER_NEWS: 0, REDDIT: 0, FUNDED: 0 });

    // Persistence Logic
    useEffect(() => {
        const savedTab = localStorage.getItem('activeTab') as SourceTab;
        if (savedTab) setActiveTab(savedTab);

        const handleScroll = () => {
            localStorage.setItem('scrollPos', window.scrollY.toString());
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        localStorage.setItem('activeTab', activeTab);
    }, [activeTab]);

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
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) console.error("Supabase Error:", error);

            if (!error && data) {
                setLeads(data);

                // Auto-scroll after leads are loaded
                setTimeout(() => {
                    const savedScroll = localStorage.getItem('scrollPos');
                    if (savedScroll) {
                        window.scrollTo({ top: parseInt(savedScroll), behavior: 'smooth' });
                    }
                }, 500);

                setStats({
                    total: data.length,
                    qualified: data.filter(l => (l.quality_score || 0) > 60).length,
                    contacted: data.filter(l => l.status === 'CONTACTED').length,
                    premium: data.filter(l => l.is_premium).length,
                    aukat: data.filter(l => !l.website && (l.rating || 0) >= 4.5 && (l.review_count || 0) >= 100).length
                });
                // Count leads by source
                const counts: Record<SourceTab, number> = { ALL: data.length, MONEY_HUNT: 0, JAN_25: 0, JAN_25_2: 0, JAN_25_3: 0, JAN_25_4: 0, JAN_26: 0, GOOGLE_MAPS: 0, GULF: 0, HACKER_NEWS: 0, REDDIT: 0, FUNDED: 0 };
                data.forEach(lead => {
                    const src = getLeadSource(lead);
                    if (src === 'MONEY_HUNT') counts.MONEY_HUNT++;
                    else if (src === 'JAN_25') counts.JAN_25++;
                    else if (src === 'JAN_25_2') counts.JAN_25_2++;
                    else if (src === 'JAN_25_3') counts.JAN_25_3++;
                    else if (src === 'JAN_25_4') counts.JAN_25_4++;
                    else if (src === 'JAN_26') counts.JAN_26++;
                    else if (src === 'GOOGLE_MAPS') counts.GOOGLE_MAPS++;
                    else if (src === 'GULF') counts.GULF++;
                    else if (src === 'HACKER_NEWS') counts.HACKER_NEWS++;
                    else if (src === 'REDDIT') counts.REDDIT++;
                    else if (src === 'VERIFIED_FUNDING' || src === 'FUNDED') counts.FUNDED++;
                });
                setSourceCounts(counts);
            }
        } catch (error) {
            console.error("Error fetching leads:", error);
        }
        setLoading(false);
    };

    const toggleContacted = async (leadId: string) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        const newStatus = lead.status === 'CONTACTED' ? 'NEW' : 'CONTACTED';

        // Optimistic UI update
        setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
        setStats(prev => ({ ...prev, contacted: prev.contacted + (newStatus === 'CONTACTED' ? 1 : -1) }));

        // DB Persistence
        const { error } = await supabase
            .from('leads')
            .update({ status: newStatus })
            .eq('id', leadId);

        if (error) {
            console.error('Failed to update status:', error);
            // Revert on error
            setLeads(leads.map(l => l.id === leadId ? { ...l, status: lead.status } : l));
            setStats(prev => ({ ...prev, contacted: prev.contacted + (lead.status === 'CONTACTED' ? 1 : -1) })); // Revert stats
        }
    };

    const togglePin = async (lead: Lead) => {
        const currentNotes = parseNotes(lead);
        const isPinned = !!currentNotes.is_pinned;
        const newNotes = { ...currentNotes, is_pinned: !isPinned };

        await supabase.from('leads').update({ notes: JSON.stringify(newNotes) }).eq('id', lead.id);
        // Optimistic update
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notes: JSON.stringify(newNotes) } : l));
    };

    const deleteLead = async (leadId: string) => {
        if (!confirm('Bhai, ye lead kachara hai? Delete kar doon?')) return;

        // Optimistic UI update
        const originalLeads = [...leads];
        setLeads(leads.filter(l => l.id !== leadId));

        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', leadId);

        if (error) {
            console.error('Delete failed:', error);
            alert('Delete failed! Database issue maybe?');
            setLeads(originalLeads); // Revert
        }
    };

    const getAnalysis = (lead: Lead) => {
        let audit: any = parseNotes(lead);
        const isPinned = !!audit.is_pinned;

        const result = {
            tag: "Optimization",
            color: "bg-slate-700 text-slate-300",
            pitch: `Hi ${lead.business_name}, I help businesses optimize their digital presence. Open to a chat?`,
            email: lead.email,
            sourceUrl: lead.google_maps_url,
            websiteUrl: lead.website,
            platform: "Maps",
            audit: audit,
            budget: null as string | null,
            isPinned
        };

        if (lead.source === 'INDEED_GULF_HUNT' || lead.source === 'LINKEDIN_AUTH_SNIPE' || lead.source === 'CENTURION_GULF_HUNT') {
            const role = audit.role || audit.job_title || 'High-Ticket Prospect';
            const isGold = audit.is_gold_mine;
            result.tag = isGold ? "GOLD MINE: High Conversion" : "Money Hunt: Hirer";
            result.color = isGold
                ? "bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/30 font-black animate-pulse"
                : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20";

            if (role.toLowerCase().includes('property') || role.toLowerCase().includes('estate') || role.toLowerCase().includes('real')) {
                result.pitch = `Hi ${lead.business_name}, I saw your property ads. You are spending significantly on Marketing, but your Website isn't optimized for luxury conversions. You are losing high-net-worth clients. Let us fix your Web infrastructure so your Ad spend converts 2x better. Open to a chat?`;
            } else if (role.toLowerCase().includes('web') || role.toLowerCase().includes('software') || role.toLowerCase().includes('it')) {
                result.pitch = `Hi ${lead.business_name}, I saw you are looking for a ${role}. Instead of hiring one person and paying monthly salary + visa, we can build your complete High-Performance Website for a fixed cost. You get a premium result without recruitment headache. Open to a chat?`;
            } else {
                result.pitch = `Hi ${lead.business_name}, I saw you are hiring for ${role}. Most high-ticket campaigns fail because the website isn't optimized for conversions. Before you spend on more staff, let us fix your Website so your traffic actually turns into revenue. Open to a chat?`;
            }
            result.platform = audit.platform || "Indeed";
        } else if (lead.source === 'HIGH_INTENT_PROJECT' || (audit && audit.intent === 'DIRECT_DEVELOPER_NEED')) {
            result.tag = "Project: Hot";
            result.color = "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/20";
            result.pitch = audit.ai_proposal || `Hi, I saw your project for ${lead.business_name}. I've handled similar tech stacks before. Can we discuss the specs?`;
            result.platform = "Freelancer";
            result.sourceUrl = audit.project_url || lead.google_maps_url;
            result.budget = audit.budget;
        } else if (lead.source === 'MISSION_CONTROL' || (audit && (audit.founder_linkedin || audit.founder_email))) {
            result.tag = "Bypass Mission";
            result.color = "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-rose-500/20";
            result.pitch = audit.connection_pitch || `Hi ${audit.founder_name || 'Founder'}, I noticed ${lead.business_name} is scaling. I help founders ship MVPs fast. Open to a quick chat?`;
            result.platform = audit.platform || "Direct";
            result.sourceUrl = audit.job_url || audit.founder_linkedin || lead.google_maps_url;
            result.email = audit.founder_email || lead.email;
        } else if (lead.is_premium) {
            result.tag = "Premium Target";
            result.color = "bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/20";
            result.pitch = `Hi ${lead.contact_name || lead.business_name}, I saw your profile and your ${lead.rating}★ rating. I specialize in high-end digital audits for premium brands. Can I send a 2-min video audit of your profile?`;
        } else if (!lead.website && (lead.rating || 0) >= 4.5 && (lead.review_count || 0) >= 50 && (lead.review_count || 0) <= 350) {
            result.tag = "Aukat Strike Target";
            result.color = "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30 font-black animate-pulse";
            result.pitch = `Hi ${lead.business_name}, I saw your profile with ${lead.review_count} reviews and it's ${lead.rating}★ - that's incredible local trust! I noticed you are missing a professional website to handle the growth. I can build a high-converting page for you. Open to a 5-min chat?`;
        } else if (!lead.website && (lead.rating || 0) >= 4.5 && (lead.review_count || 0) >= 50) {
            result.tag = "Top Rated Target";
            result.color = "bg-purple-500/20 text-purple-400";
            result.pitch = `Hi ${lead.business_name}, I saw you're one of the top-rated local spots (${lead.rating}★), but I couldn't find your website to check your services. I help businesses like yours get a professional digital presence. Can I send a sample?`;
        } else if (!lead.website) {
            result.tag = "No Website";
            result.color = "bg-emerald-500/20 text-emerald-400";
            result.pitch = `Hi ${lead.business_name}, I noticed you don't have a website listed on Maps yet. I'm a local dev and I build quick, affordable sites for businesses in the area. Can I send you a 1-page demo?`;
        }

        return result;
    };

    const filteredLeads = leads.filter(l => {
        const matchesSearch = l.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (l.phone && l.phone.includes(searchTerm));
        const matchesPremium = showPremiumOnly ? l.is_premium : true;
        // Source tab filter
        let matchesSource = true;
        if (activeTab !== 'ALL') {
            const leadSource = getLeadSource(l);
            if (activeTab === 'JAN_25') matchesSource = leadSource === 'JAN_25';
            else if (activeTab === 'JAN_25_2') matchesSource = leadSource === 'JAN_25_2';
            else if (activeTab === 'JAN_25_3') matchesSource = leadSource === 'JAN_25_3';
            else if (activeTab === 'JAN_25_4') matchesSource = leadSource === 'JAN_25_4';
            else if (activeTab === 'GOOGLE_MAPS') matchesSource = leadSource === 'GOOGLE_MAPS';
            else if (activeTab === 'GULF') matchesSource = leadSource === 'GULF' || leadSource === 'GULF_SNIPER';
            else if (activeTab === 'HACKER_NEWS') matchesSource = leadSource === 'HACKER_NEWS';
            else if (activeTab === 'REDDIT') matchesSource = leadSource === 'REDDIT';
            else if (activeTab === 'FUNDED') matchesSource = leadSource === 'VERIFIED_FUNDING' || leadSource === 'FUNDED';
            else if (activeTab === 'MONEY_HUNT') matchesSource = leadSource === 'MONEY_HUNT';
        }
        return matchesSearch && matchesPremium && matchesSource;
    }).sort((a, b) => {
        const aAnalysis = getAnalysis(a);
        const bAnalysis = getAnalysis(b);

        // Priority 0: PINNED (Absolute Top)
        if (aAnalysis.isPinned && !bAnalysis.isPinned) return -1;
        if (!aAnalysis.isPinned && bAnalysis.isPinned) return 1;

        // Priority 1: Aukat Strike Target
        if (aAnalysis.tag === "Aukat Strike Target" && bAnalysis.tag !== "Aukat Strike Target") return -1;
        if (aAnalysis.tag !== "Aukat Strike Target" && bAnalysis.tag === "Aukat Strike Target") return 1;

        // Priority 2: Review Count
        return (b.review_count || 0) - (a.review_count || 0);
    });

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

                    <div className="grid grid-cols-4 gap-2 md:gap-4 w-full md:w-auto">
                        <StatItem label="Total" value={stats.total} color="text-blue-400" />
                        <StatItem label="Aukat" value={stats.aukat} color="text-red-500" />
                        <StatItem label="Hot" value={stats.qualified} color="text-emerald-400" />
                        <StatItem label="Done" value={stats.contacted} color="text-purple-400" />
                    </div>
                </div>
            </div>

            {/* Source Tabs */}
            <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {SOURCE_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        const count = sourceCounts[tab.key];
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap border ${isActive
                                    ? `bg-${tab.color}-500/20 border-${tab.color}-500 text-${tab.color}-400`
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                style={isActive ? { backgroundColor: `var(--${tab.color}-500-20, rgba(59,130,246,0.2))` } : {}}
                            >
                                <Icon size={16} />
                                {tab.label}
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? `bg-${tab.color}-500/30` : 'bg-slate-700'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
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
                    <button
                        onClick={() => setShowPremiumOnly(!showPremiumOnly)}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all border ${showPremiumOnly ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}
                    >
                        <Star className={`w-4 h-4 ${showPremiumOnly ? 'fill-current' : ''}`} /> Premium Only
                    </button>
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
                                {filteredLeads.map((lead, index) => {
                                    const analysis = getAnalysis(lead);
                                    return (
                                        <LeadCard
                                            key={lead.id}
                                            lead={lead}
                                            index={index + 1}
                                            onToggle={() => toggleContacted(lead.id)}
                                            onTogglePin={() => togglePin(lead)}
                                            onDelete={() => deleteLead(lead.id)}
                                            pitch={analysis.pitch}
                                            analysis={analysis}
                                        />
                                    );
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
                                        {filteredLeads.map((lead, index) => {
                                            const analysis = getAnalysis(lead);
                                            return <LeadRow key={lead.id} index={index + 1} lead={lead} onToggle={() => toggleContacted(lead.id)} onTogglePin={() => togglePin(lead)} onDelete={() => deleteLead(lead.id)} pitch={analysis.pitch} analysis={analysis} />
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

function LeadCard({ lead, index, onToggle, onTogglePin, onDelete, pitch, analysis }: {
    lead: Lead,
    index: number,
    onToggle: () => void,
    onTogglePin: () => void,
    onDelete: () => void,
    pitch: string,
    analysis: {
        tag: string,
        color: string,
        email?: string | null,
        platform?: string,
        sourceUrl: string,
        websiteUrl: string | null,
        budget?: string | null,
        audit?: any,
        isPinned: boolean
    }
}) {
    return (
        <div className={`group relative bg-slate-800/40 border ${analysis.isPinned ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700'} rounded-2xl p-5 hover:border-blue-500/50 transition-all ${lead.status === 'CONTACTED' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
            {/* GHAJINI-PROOF INDEXING */}
            <div className="absolute -left-4 top-1/2 -translate-y-1/2 z-10">
                <div className="bg-slate-900 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-xl border-2 border-white transform -rotate-12 group-hover:rotate-0 transition-transform duration-300">
                    #{index}
                </div>
            </div>

            <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded w-fit ${analysis.color}`}>
                            {analysis.tag}
                        </span>
                        <h3 className="font-bold text-slate-100 line-clamp-1 group-hover:text-blue-400 transition-colors" title={lead.business_name}>{lead.business_name}</h3>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                        className={`p-1.5 rounded-lg transition-all ${analysis.isPinned ? 'text-amber-400 bg-amber-500/10' : 'text-slate-600 hover:text-amber-400'}`}
                        title="Pin this lead"
                    >
                        <Pin className={`w-4 h-4 ${analysis.isPinned ? 'fill-current' : ''}`} />
                    </button>
                    <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-lg text-xs font-bold">
                        {analysis.budget ? analysis.budget : <><Star className="w-3 h-3 fill-current" /> {lead.rating}</>}
                    </div>
                </div>
            </div>

            <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-500 shrink-0" />
                    <span className="line-clamp-2">{lead.address || "Address not fully captured"}</span>
                </div>
                <div className="flex items-center gap-3">
                    {lead.phone ? (
                        <div className={`flex items-center gap-2 text-xs font-mono font-bold px-2 py-1 rounded ${lead.phone_type === 'MOBILE' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                            {lead.phone_type === 'MOBILE' ? <Phone className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                            {lead.phone} {lead.phone_type === 'LANDLINE' && <span className="text-[8px] opacity-70 ml-1">(Landline)</span>}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-xs text-slate-500 italic bg-slate-700/30 px-2 py-1 rounded">
                            <Info className="w-3 h-3" /> No Number
                        </div>
                    )}
                    {analysis.websiteUrl && (
                        <a
                            href={analysis.websiteUrl.startsWith('http') ? analysis.websiteUrl : `https://${analysis.websiteUrl}`}
                            target="_blank"
                            className="flex-1 flex items-center justify-center gap-2 p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all text-[11px] font-black uppercase border border-blue-500/20"
                        >
                            <Globe className="w-4 h-4" /> VISIT SITE
                        </a>
                    )}
                    {lead.phone && (lead.phone_type === 'MOBILE' || (lead.phone.startsWith('91') && lead.phone.length === 12)) && (
                        <a
                            href={`https://wa.me/${formatPhoneForWhatsApp(lead.phone!)}`}
                            target="_blank"
                            className="flex-1 flex items-center justify-center gap-2 p-2 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all text-[11px] font-black uppercase border border-green-500/20"
                        >
                            <MessageCircle className="w-4 h-4" /> WHATSAPP
                        </a>
                    )}
                    <a
                        href={lead.google_maps_url}
                        target="_blank"
                        className="flex-1 flex items-center justify-center gap-2 p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-[11px] font-black uppercase border border-emerald-500/20"
                    >
                        <MapPin className="w-4 h-4" /> MAPS
                    </a>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 group"
                        title="Kill this junk lead"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {analysis.audit && (
                <div className="mb-4 bg-slate-900/50 rounded-xl p-3 border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Audit Score</span>
                        <span className={`text-[10px] font-bold ${analysis.audit.score > 70 ? 'text-emerald-400' : 'text-amber-400'}`}>{analysis.audit.score}%</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {analysis.audit.issues && analysis.audit.issues.map((issue: string, i: number) => (
                            <span key={i} className="text-[9px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded border border-white/5">
                                Issue: {issue}
                            </span>
                        ))}
                        {(!analysis.audit.issues || analysis.audit.issues.length === 0) && <span className="text-[9px] text-emerald-400 font-bold">Verified: No critical gaps found</span>}
                    </div>
                </div>
            )}

            <div className="mb-4 bg-blue-500/5 rounded-xl p-4 border border-blue-500/10">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Outreach Pitch</span>
                    <CopyPitchButton pitch={pitch} />
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300 italic">
                    "{pitch}"
                </p>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={onToggle}
                    title={lead.status === 'CONTACTED' ? "Mark as New" : "Mark as Contacted"}
                    className={`flex-1 flex justify-center py-2.5 rounded-xl transition-all border
                            ${lead.status === 'CONTACTED' ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'}
                        `}
                >
                    {lead.status === 'CONTACTED' ? <XCircle size={18} /> : <CheckCircle size={18} />}
                </button>
                <CopyPitchButton pitch={pitch} isFullButton={true} tag={analysis.tag} />
            </div>

            <div className="flex flex-col gap-2 mt-4">
                {isWhatsAppCapable(lead) ? (
                    <a
                        href={`https://wa.me/${formatPhoneForWhatsApp(lead.phone!)}?text=${encodeURIComponent(pitch)}`}
                        target="_blank"
                        className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/30 text-lg active:scale-95 transition-all border-b-4 border-emerald-700"
                    >
                        <Send size={24} /> WHATSAPP STRIKE
                    </a>
                ) : (
                    <a
                        href={lead.google_maps_url}
                        target="_blank"
                        className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-500/30 text-lg active:scale-95 transition-all border-b-4 border-orange-700"
                    >
                        <Search size={24} /> FIND NUMBER ON MAPS
                    </a>
                )}

                <div className="flex gap-2">
                    {analysis.email && (
                        <button
                            onClick={() => {
                                const subject = encodeURIComponent(`Regarding your ${analysis.audit?.job_title || 'project'} proposal`);
                                const body = encodeURIComponent(`Hi ${analysis.audit?.founder_name || 'Founder'},\n\nI saw your post regarding ${analysis.audit?.job_title || 'hiring'}. Instead of a freelance headache, my agency can deliver this project directly with 24/7 support.\n\nBest regards,\nHarun`);
                                window.location.href = `mailto:${analysis.email}?subject=${subject}&body=${body}`;
                            }}
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 text-xs active:scale-95 transition-all"
                        >
                            <Mail size={14} /> Email
                        </button>
                    )}
                    {analysis.audit?.founder_linkedin && (
                        <a
                            href={analysis.audit.founder_linkedin}
                            target="_blank"
                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-900/30 text-xs active:scale-95 transition-all"
                        >
                            <ExternalLink size={14} /> LinkedIn
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

function LeadRow({ lead, index, onToggle, onTogglePin, onDelete, pitch, analysis }: {
    lead: Lead,
    index: number,
    onToggle: () => void,
    onTogglePin: () => void,
    onDelete: () => void,
    pitch: string,
    analysis: {
        tag: string,
        color: string,
        sourceUrl: string,
        websiteUrl: string | null,
        audit?: any,
        isPinned: boolean
    }
}) {
    return (
        <tr className={`hover:bg-slate-800/40 transition-colors ${lead.status === 'CONTACTED' ? 'opacity-40' : ''} ${analysis.isPinned ? 'bg-amber-500/5' : ''}`}>
            <td className="p-4">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-500 w-6">#{index}</span>
                    <div>
                        <div className="font-bold text-sm text-slate-200">{lead.business_name}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 shrink-0"><MapPin size={10} /> <span className="truncate max-w-[200px]">{lead.address}</span></div>
                    </div>
                </div>
            </td>
            <td className="p-4">
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${analysis.color}`}>
                    {analysis.tag}
                </span>
            </td>
            <td className="p-4 text-xs font-mono">
                {lead.phone ? (
                    <div className="flex items-center gap-2">
                        <span className={lead.phone_type === 'MOBILE' ? "text-emerald-400" : "text-amber-400"}>{lead.phone}</span>
                        {lead.phone_type === 'MOBILE' ? <span className="text-[8px] bg-emerald-500/10 px-1 rounded">M</span> : <span className="text-[8px] bg-amber-500/10 px-1 rounded text-amber-500">L</span>}
                    </div>
                ) : <span className="text-slate-500 italic">None</span>}
            </td>
            <td className="p-4">
                <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold"><Star size={12} fill="currentColor" /> {lead.rating} <span className="text-slate-500 font-normal">({lead.review_count})</span></div>
            </td>
            <td className="p-4 text-right">
                <div className="flex justify-end gap-3 items-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                        className={`p-1.5 rounded-lg transition-all ${analysis.isPinned ? 'text-amber-400 bg-amber-500/10' : 'text-slate-600 hover:text-amber-400'}`}
                        title="Pin this lead"
                    >
                        <Pin size={16} className={`${analysis.isPinned ? 'fill-current' : ''}`} />
                    </button>
                    {analysis.websiteUrl && (
                        <a href={analysis.websiteUrl.startsWith('http') ? analysis.websiteUrl : `https://${analysis.websiteUrl}`} target="_blank" className="p-2 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-lg transition-all border border-blue-500/20" title="Visit Website">
                            <Globe size={18} />
                        </a>
                    )}
                    <a href={lead.google_maps_url} target="_blank" className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg transition-all border border-emerald-500/20" title="Google Maps">
                        <MapPin size={18} />
                    </a>
                    {isWhatsAppCapable(lead) ? (
                        <a
                            href={`https://wa.me/${formatPhoneForWhatsApp(lead.phone!)}?text=${encodeURIComponent(pitch)}`}
                            target="_blank"
                            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white px-6 py-2.5 rounded-xl text-sm font-black transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2 border-b-2 border-emerald-700 active:translate-y-0.5"
                        >
                            <Send size={16} /> STRIKE
                        </a>
                    ) : (
                        <a
                            href={lead.google_maps_url}
                            target="_blank"
                            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-orange-500/30 flex items-center gap-2 border-b-2 border-orange-700"
                        >
                            <Search size={14} /> FIND
                        </a>
                    )}
                    <button onClick={onDelete} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20" title="Delete Lead">
                        <Trash2 size={18} />
                    </button>
                    <button onClick={onToggle} className={`p-2 rounded-lg transition-all border ${lead.status === 'CONTACTED' ? 'bg-slate-700 text-slate-500' : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'}`}>
                        {lead.status === 'CONTACTED' ? <XCircle size={18} /> : <CheckCircle size={18} />}
                    </button>
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

function CopyPitchButton({ pitch, isFullButton, tag }: { pitch: string, isFullButton?: boolean, tag?: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(pitch);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isFullButton) {
        return (
            <button
                onClick={copy}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all ${copied ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
            >
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                <span className="text-[10px] font-bold uppercase">{copied ? "Copied!" : (tag?.includes('Project') ? "Copy Proposal" : "Copy Pitch")}</span>
            </button>
        );
    }

    return (
        <button onClick={copy} className="text-[9px] font-bold text-slate-500 hover:text-blue-400 uppercase transition-colors">
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}
