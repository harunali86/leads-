
"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Phone, MapPin, Globe, Star, Plus, Search,
    ExternalLink, CheckCircle, XCircle, Info, Menu, X, LayoutGrid, List,
    Mail, UserPlus, Copy, Map, Newspaper, MessageCircle, DollarSign, Send
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
    contacted: boolean;
    is_premium?: boolean;
    source?: string;
    contact_name?: string | null;
    notes?: string | null;
}

const isWhatsAppCapable = (lead: Lead) => {
    if (!lead.phone) return false;
    const clean = lead.phone.replace(/\D/g, '');
    return clean.length >= 10; // Be permissive, show button if number looks real
};

// Source types for tab filtering
type SourceTab = 'ALL' | 'GOOGLE_MAPS' | 'GULF' | 'HACKER_NEWS' | 'REDDIT' | 'FUNDED';

const SOURCE_TABS: { key: SourceTab; label: string; icon: any; color: string }[] = [
    { key: 'ALL', label: 'All', icon: LayoutGrid, color: 'blue' },
    { key: 'GULF', label: 'Gulf', icon: Globe, color: 'purple' },
    { key: 'GOOGLE_MAPS', label: 'Maps', icon: Map, color: 'emerald' },
    { key: 'HACKER_NEWS', label: 'HN', icon: Newspaper, color: 'orange' },
    { key: 'REDDIT', label: 'Reddit', icon: MessageCircle, color: 'red' },
    { key: 'FUNDED', label: 'Funded', icon: DollarSign, color: 'cyan' },
];

// Helper to detect lead source from notes
const getLeadSource = (lead: Lead): string => {
    try {
        if (lead.notes) {
            const notes = JSON.parse(lead.notes);
            if (notes.source) return notes.source;
            if (notes.market === 'MIDDLE_EAST') return 'GULF';
        }
    } catch (e) { }
    if (lead.source === 'GULF_SNIPER') return 'GULF';
    if (lead.source) return lead.source;
    if (lead.business_name?.startsWith('[HN]')) return 'HACKER_NEWS';
    if (lead.business_name?.startsWith('[Reddit]')) return 'REDDIT';
    if (lead.business_name?.startsWith('[FUNDED]')) return 'VERIFIED_FUNDING';
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
    const [sourceCounts, setSourceCounts] = useState<Record<SourceTab, number>>({ ALL: 0, GOOGLE_MAPS: 0, GULF: 0, HACKER_NEWS: 0, REDDIT: 0, FUNDED: 0 });

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

        if (error) console.error("Supabase Error:", error);

        if (!error && data) {
            setLeads(data);
            setStats({
                total: data.length,
                qualified: data.filter(l => (l.quality_score || 0) > 60).length,
                contacted: data.filter(l => l.status === 'CONTACTED' || l.contacted).length,
                premium: data.filter(l => l.is_premium).length,
                aukat: data.filter(l => !l.website && (l.rating || 0) >= 4.5 && (l.review_count || 0) >= 100).length
            });
            // Count leads by source
            const counts: Record<SourceTab, number> = { ALL: data.length, GOOGLE_MAPS: 0, GULF: 0, HACKER_NEWS: 0, REDDIT: 0, FUNDED: 0 };
            data.forEach(lead => {
                const src = getLeadSource(lead);
                if (src === 'GOOGLE_MAPS') counts.GOOGLE_MAPS++;
                else if (src === 'GULF') counts.GULF++;
                else if (src === 'HACKER_NEWS') counts.HACKER_NEWS++;
                else if (src === 'REDDIT') counts.REDDIT++;
                else if (src === 'VERIFIED_FUNDING' || src === 'FUNDED') counts.FUNDED++;
            });
            setSourceCounts(counts);
        }
        setLoading(false);
    };

    const toggleContacted = async (id: string, current: boolean) => {
        await supabase.from('leads').update({ contacted: !current }).eq('id', id);
        setLeads(prev => prev.map(l => l.id === id ? { ...l, contacted: !current } : l));
        setStats(prev => ({ ...prev, contacted: prev.contacted + (current ? -1 : 1) }));
    };

    const getAnalysis = (lead: Lead): {
        tag: string,
        color: string,
        pitch: string,
        email?: string | null,
        platform?: string,
        jobUrl?: string | null,
        budget?: string,
        audit?: any
    } => {
        let audit: any = null;
        try { if (lead.notes) audit = JSON.parse(lead.notes); } catch (e) { }

        if (lead.source === 'HIGH_INTENT_PROJECT' || (audit && (audit.source === 'HIGH_INTENT_PROJECT' || audit.intent === 'DIRECT_DEVELOPER_NEED'))) {
            const projectTitle = (audit && audit.job_title) || lead.business_name.replace('[PROJECT] ', '');
            const budget = (audit && audit.budget) || 'Inquiry';

            return {
                tag: "Project: Hot",
                color: "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/20",
                pitch: audit.ai_proposal || `Custom pitch for ${projectTitle} is being prepared...`,
                email: lead.email as string | null,
                platform: "Freelancer",
                jobUrl: (audit.project_url || lead.google_maps_url) as string | null,
                budget: budget,
                audit: audit
            };
        }

        if (lead.source === 'MISSION_CONTROL' || lead.source === 'QUALITY_SNIPER' || lead.source === 'QUALITY_BUREAU' || (audit && (audit.founder_linkedin || audit.founder_email))) {
            const founderName = audit.founder_name || lead.contact_name || 'Founder';
            const jobTitle = audit.job_title || 'Project';
            const platform = audit.platform || 'Job Board';
            const email = audit.founder_email || lead.email;
            const connectionPitch = audit.connection_pitch || `Hi ${founderName}, I saw ${platform} mentioned that you're looking for a ${jobTitle}. I'm a developer specializing in rapid high-performance builds. Skip the portal clutter—let's handle this direct. Open to a 2-min chat?`;

            return {
                tag: "Bypass Mission",
                color: "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-rose-500/20",
                pitch: connectionPitch,
                email: email as string | null,
                platform: platform,
                jobUrl: (audit.job_url || lead.google_maps_url) as string | null,
                audit: audit
            };
        }

        if (lead.is_premium) {
            let hook = "I have a growth strategy specifically for your niche.";
            return {
                tag: "Premium Target",
                color: "bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/20",
                pitch: `Hi ${lead.contact_name || lead.business_name}, I saw your profile on LinkedIn. ${hook} Open to a 5-min audit chat?`,
                audit: audit
            };
        }

        if (!lead.website && (lead.rating || 0) >= 4.5 && (lead.review_count || 0) >= 100) return {
            tag: "Aukat Strike Target",
            color: "bg-red-500/20 text-red-500 border border-red-500/30 font-black",
            pitch: `Hi ${lead.business_name}, I saw your legacy profile with ${(lead.review_count || 0)} reviews. You're a leader in the market, but your digital presence is missing. Can we talk about a high-end Next.js page?`,
            platform: "Google Maps",
            jobUrl: lead.google_maps_url
        };
        if (!lead.website && (lead.rating || 0) >= 4.5 && (lead.review_count || 0) >= 50) return {
            tag: "Top Rated Target",
            color: "bg-purple-500/20 text-purple-400",
            pitch: `Hi ${lead.business_name}, I saw you're one of the top-rated in the area (${lead.rating} Stars), but I couldn't find your website. Interested?`,
            platform: "Google Maps",
            jobUrl: lead.google_maps_url
        };
        if (!lead.website) return {
            tag: "No Website",
            color: "bg-emerald-500/20 text-emerald-400",
            pitch: `Hi ${lead.business_name}, noticed you don't have a website listed on Maps. We build professional web pages. Can I send a demo?`,
            platform: "Google Maps",
            jobUrl: lead.google_maps_url
        };

        if (lead.source === 'VERIFIED_FUNDING' || (audit && audit.source === 'VERIFIED_FUNDING')) {
            const founderName = lead.contact_name || 'Founder';
            const company = lead.business_name.replace('[FUNDED] ', '');
            const amount = audit.funding_amount || 'Seed';
            const pitch = `Hi ${founderName}, congratulations on the ${amount} funding for ${company}! I am a developer specializing in rapid React/Next.js scaling. Given your new growth phase, I can help you ship features faster while you build your core team. Open to a brief chat?`;

            return {
                tag: "Verified: Funded",
                color: "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20",
                pitch: pitch,
                email: lead.email as string | null,
                platform: "Direct Email",
                jobUrl: lead.google_maps_url as string | null,
                audit: audit
            };
        }

        return {
            tag: "Optimization",
            color: "bg-slate-700 text-slate-300",
            pitch: `Hi ${lead.business_name}, I help businesses optimize their digital presence. Open to a chat?`,
            platform: lead.google_maps_url?.includes('maps') ? "Google Maps" : "Source",
            jobUrl: lead.google_maps_url
        };
    };

    const filteredLeads = leads.filter(l => {
        const matchesSearch = l.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (l.phone && l.phone.includes(searchTerm));
        const matchesPremium = showPremiumOnly ? l.is_premium : true;
        // Source tab filter
        let matchesSource = true;
        if (activeTab !== 'ALL') {
            const leadSource = getLeadSource(l);
            if (activeTab === 'GOOGLE_MAPS') matchesSource = leadSource === 'GOOGLE_MAPS';
            else if (activeTab === 'GULF') matchesSource = leadSource === 'GULF' || leadSource === 'GULF_SNIPER';
            else if (activeTab === 'HACKER_NEWS') matchesSource = leadSource === 'HACKER_NEWS';
            else if (activeTab === 'REDDIT') matchesSource = leadSource === 'REDDIT';
            else if (activeTab === 'FUNDED') matchesSource = leadSource === 'VERIFIED_FUNDING' || leadSource === 'FUNDED';
        }
        return matchesSearch && matchesPremium && matchesSource;
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

function LeadCard({ lead, onToggle, pitch, analysis }: { lead: Lead, onToggle: () => void, pitch: string, analysis: { tag: string, color: string, email?: string | null, platform?: string, jobUrl?: string | null, budget?: string, audit?: any } }) {
    const [copied, setCopied] = useState(false);

    const copyPitch = () => {
        navigator.clipboard.writeText(pitch);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const sendEmail = () => {
        if (!analysis.email) return;
        const subject = encodeURIComponent(`Regarding your ${analysis.audit?.job_title || 'project'} proposal`);
        const body = encodeURIComponent(`Hi ${analysis.audit?.founder_name || 'Founder'},\n\nI saw your post regarding ${analysis.audit?.job_title || 'hiring'}. Instead of a freelance headache, my agency can deliver this project directly with 24/7 support.\n\nBest regards,\nHarun`);
        window.location.href = `mailto:${analysis.email}?subject=${subject}&body=${body}`;
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
                    {analysis.budget ? analysis.budget : <><Star className="w-3 h-3 fill-current" /> {lead.rating}</>}
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
                    {lead.website ? (
                        <a
                            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            className="p-1 px-2 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center gap-1 text-[10px] font-bold uppercase border border-blue-500/20"
                        >
                            <Globe className="w-3 h-3" /> Visit Site
                        </a>
                    ) : (
                        <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded font-bold uppercase border border-red-500/20">
                            <XCircle className="w-3 h-3" /> No Website
                        </div>
                    )}
                    <a
                        href={analysis.jobUrl || lead.google_maps_url}
                        target="_blank"
                        className="p-1 px-2 rounded bg-slate-700/50 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold uppercase border border-white/5"
                    >
                        <MapPin className="w-3 h-3" /> View Source
                    </a>
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
            )
            }

            <div className="mb-4 bg-blue-500/5 rounded-xl p-4 border border-blue-500/10">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Outreach Pitch</span>
                    <button onClick={copyPitch} className="text-[9px] font-bold text-slate-500 hover:text-blue-400 uppercase transition-colors">
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300 italic">
                    "{pitch}"
                </p>
            </div>

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
                    title={analysis.tag.includes('Project') ? "Copy AI Proposal" : "Copy Pitch message"}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all ${copied ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                >
                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    <span className="text-[10px] font-bold uppercase">{copied ? "Copied!" : (analysis.tag.includes('Project') ? "Copy AI Proposal" : "Copy Pitch")}</span>
                </button>
            </div>

            <div className="flex flex-col gap-2">
                {analysis.email && (
                    <button
                        onClick={sendEmail}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 text-sm active:scale-95 transition-all"
                    >
                        <Mail size={16} /> Send Direct Email
                    </button>
                )}

                {analysis.audit && analysis.audit.founder_linkedin ? (
                    <a
                        href={analysis.audit.founder_linkedin}
                        target="_blank"
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-900/30 text-sm active:scale-95 transition-all"
                    >
                        <ExternalLink size={16} /> Message Founder (Direct)
                    </a>
                ) : null}

                {isWhatsAppCapable(lead) ? (
                    <a
                        href={`https://wa.me/${lead.phone!.replace(/\D/g, '')}?text=${encodeURIComponent(pitch)}`}
                        target="_blank"
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-900/40 text-sm active:scale-95 transition-all mt-2"
                    >
                        <Send size={16} /> WhatsApp Strike
                    </a>
                ) : null}
            </div>
        </div>
    );
}

function LeadRow({ lead, onToggle, pitch, analysis }: { lead: Lead, onToggle: () => void, pitch: string, analysis: { tag: string, color: string, audit?: any } }) {
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
                <div className="flex justify-end gap-2">
                    <a href={lead.google_maps_url} target="_blank" className="p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-500" title="Source"><Globe size={16} /></a>
                    <button onClick={onToggle} className="p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-500">{lead.contacted ? <XCircle size={16} /> : <CheckCircle size={16} />}</button>
                    {isWhatsAppCapable(lead) && (
                        <a
                            href={`https://wa.me/${lead.phone!.replace(/\D/g, '')}?text=${encodeURIComponent(pitch)}`}
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
