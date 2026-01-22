
"use server";

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
    const password = formData.get('password') as string;
    const CORRECT_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin';

    if (password === CORRECT_PASSWORD) {
        (await cookies()).set('auth_session', 'authenticated', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
        });
        redirect('/');
    } else {
        return { error: 'Incorrect Password' };
    }
}

export async function logout() {
    (await cookies()).delete('auth_session');
    redirect('/');
}
