import { Navigate } from 'react-router-dom';
import { useSession } from '@/store/session';

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const isAdmin = useSession((s) => s.isAdmin);
  if (!isAdmin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
