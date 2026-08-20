import { Navigate } from 'react-router-dom';
import { useSession } from '@/store/session';
import type { SessionRole } from '@/store/session';

export default function RequireRole({
  role,
  children,
}: {
  role: SessionRole;
  children: React.ReactNode;
}) {
  const currentRole = useSession((s) => s.role);
  if (currentRole !== role) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
