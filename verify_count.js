
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://winzuwrfkzkwqhysyjag.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpbnp1d3Jma3prd3FoeXN5amFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODg5MTkyNiwiZXhwIjoyMDg0NDY3OTI2fQ.USWNW2wYWAygHGZrWvjv0WkWLXsOlgju_jf58RGZ_do'
);

(async () => {
    try {
        const { data: leads, error } = await supabase
            .from('leads')
            .select('business_name, review_count, rating, phone, website');

        if (error) {
            console.error('Supabase Error:', error);
            return;
        }

        const keywords = ['luxury', 'premium', 'diamond', 'gold', 'jewel', 'realty', 'estate', 'robotic', 'implant', 'architect', 'villa', 'residency', 'heights', 'developer', 'associate', 'international', 'wedding', 'event', 'clinic', 'fitness', 'gym', 'skin', 'derma', 'dental'];

        const survivors = leads.filter(l => {
            if (l.website) return false;
            if (!l.phone) return false;
            if ((l.review_count || 0) < 100) return false;

            const name = (l.business_name || '').toLowerCase();
            const isHighValue = keywords.some(w => name.includes(w)) || (l.rating || 0) >= 4.7;
            return isHighValue;
        });

        console.log('✅ 100+ Review Sniper List Count:', survivors.length);
        console.log('--- Top 5 Candidates ---');
        survivors
            .sort((a, b) => b.review_count - a.review_count)
            .slice(0, 5)
            .forEach(l => console.log(`${l.business_name} | Reviews: ${l.review_count} | Rating: ${l.rating}`));

    } catch (e) {
        console.error('Script Error:', e);
    }
})();
