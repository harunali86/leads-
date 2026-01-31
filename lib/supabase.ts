
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
        throw new Error('Invalid Supabase URL format. URL must start with https://');
    }

    if (supabaseKey.length < 32) {
        throw new Error('Invalid Supabase key format. Key appears to be too short.');
    }
}

validateSupabaseConfig();

export const supabase = createClient(supabaseUrl, supabaseKey);
