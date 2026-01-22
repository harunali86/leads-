
import { cookies } from 'next/headers';
import DashboardClient from '@/app/components/DashboardClient';
import LoginForm from '@/app/components/LoginForm';

export default async function Page() {
  const cookieStore = await cookies();
  const session = cookieStore.get('auth_session');

  if (session?.value === 'authenticated') {
    return <DashboardClient />;
  } else {
    return <LoginForm />;
  }
}
