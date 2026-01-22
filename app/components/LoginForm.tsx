
"use client";

import { useState } from 'react';
import { login } from '@/app/actions';
import { Lock } from 'lucide-react';

export default function LoginForm() {
    const [error, setError] = useState('');

    const handleSubmit = async (formData: FormData) => {
        const result = await login(formData);
        if (result?.error) {
            setError(result.error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-800 rounded-xl border border-slate-700 shadow-2xl p-8">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-600/30">
                        <Lock className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Secure Access</h1>
                    <p className="text-slate-400 text-sm mt-1">LeadForge Command Center</p>
                </div>

                <form action={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                            Access Password
                        </label>
                        <input
                            name="password"
                            type="password"
                            required
                            placeholder="Enter system password..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center font-medium animate-pulse">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02]"
                    >
                        Authenticate
                    </button>
                </form>
            </div>
        </div>
    );
}
