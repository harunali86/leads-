
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Admin Client (Bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, business_name } = body;

        console.log(`🔥 API: Nuclear Delete Request for: ${business_name} (${id})`);

        if (!business_name && !id) {
            return NextResponse.json({ error: 'Missing business_name or id' }, { status: 400 });
        }

        let query = supabaseAdmin.from('leads').delete({ count: 'exact' });

        // Prefer Business Name for duplicate cleanup
        if (business_name) {
            query = query.eq('business_name', business_name);
        } else {
            query = query.eq('id', id);
        }

        const { error, count } = await query;

        if (error) {
            console.error('API Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`✅ API: Deleted ${count} rows.`);
        return NextResponse.json({ success: true, count });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
