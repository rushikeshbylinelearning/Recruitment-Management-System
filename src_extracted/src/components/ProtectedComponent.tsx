import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import PermissionDenied from './PermissionDenied';

interface ProtectedComponentProps {
  module: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredRole?: string;
  customMessage?: string;
  showContactAdmin?: boolean;
}

export default function ProtectedComponent({
  module,
  action,
  children,
  fallback,
  requiredRole,
  customMessage,
  showContactAdmin = true
}: ProtectedComponentProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(module, action)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <PermissionDenied
        module={module}
        action={action}
        requiredRole={requiredRole}
        customMessage={customMessage}
        showContactAdmin={showContactAdmin}
      />
    );
  }

  return <>{children}</>;
}

// Hook for conditional rendering based on permissions
export function usePermission(module: string, action: string) {
  const { hasPermission } = useAuth();
  return hasPermission(module, action);
}

// Hook for multiple permission checks
export function usePermissions(permissions: Array<{module: string, action: string}>) {
  const { hasPermission } = useAuth();
  return permissions.every(({ module, action }) => hasPermission(module, action));
}
