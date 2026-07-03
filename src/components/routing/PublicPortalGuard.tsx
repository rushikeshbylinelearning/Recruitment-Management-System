import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isHrOnlyPath } from '../../utils/domain';

/**
 * Blocks HR/admin routes on the public apply portal.
 */
export default function PublicPortalGuard({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  if (isHrOnlyPath(pathname)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
