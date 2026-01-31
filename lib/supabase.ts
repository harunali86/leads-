
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Validates that required Supabase environment variables are set
 * @throws {Error} If environment variables are missing or invalid
 */
function validateSupabaseConfig(): void {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error(
            'Missing Supabase configuration. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment.'
        );
    }

    if (!supabaseUrl.startsWith('https://')) {
        // Allow http://localhost or http://127.0.0.1 in development
        const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)/.test(supabaseUrl);
        const isDevelopment = process.env.NODE_ENV !== 'production';

        if (!isLocalhost || !isDevelopment) {
            throw new Error(
                'Invalid Supabase URL format. URL must start with https:// (http://localhost is allowed in development)'
            );
        }
    }

    if (supabaseKey.length < 32) {
        throw new Error('Invalid Supabase key format. Key appears to be too short.');
    }
}

validateSupabaseConfig();

export const supabase = createClient(supabaseUrl, supabaseKey);
