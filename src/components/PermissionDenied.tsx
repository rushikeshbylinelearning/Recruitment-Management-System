import React from 'react';
import { Shield, Lock, AlertTriangle } from 'lucide-react';

interface PermissionDeniedProps {
  module: string;
  action: string;
  requiredRole?: string;
  customMessage?: string;
  showContactAdmin?: boolean;
}

export default function PermissionDenied({ 
  module, 
  action, 
  requiredRole, 
  customMessage,
  showContactAdmin = true 
}: PermissionDeniedProps) {
  const getActionDescription = (action: string) => {
    switch (action) {
      case 'view': return 'view this content';
      case 'create': return 'create new items';
      case 'edit': return 'edit existing items';
      case 'delete': return 'delete items';
      default: return `perform ${action} actions`;
    }
  };

  const getModuleDescription = (module: string) => {
    switch (module) {
      case 'dashboard': return 'Dashboard';
      case 'jobs': return 'Job Management';
      case 'candidates': return 'Candidate Management';
      case 'communications': return 'Communications';
      case 'tasks': return 'Task Management';
      case 'team': return 'Team Management';
      case 'analytics': return 'Analytics';
      case 'settings': return 'System Settings';
      default: return module.charAt(0).toUpperCase() + module.slice(1);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            {customMessage || `You don't have permission to ${getActionDescription(action)} in ${getModuleDescription(module)}.`}
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-left">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">Permission Required</h3>
              <p className="text-sm text-yellow-700">
                You need <strong>{action}</strong> permission for <strong>{getModuleDescription(module)}</strong> to access this feature.
                {requiredRole && ` This feature is typically available to ${requiredRole} role.`}
              </p>
            </div>
          </div>
        </div>

        {showContactAdmin && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Lock className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <h3 className="text-sm font-medium text-blue-800 mb-1">Need Access?</h3>
                <p className="text-sm text-blue-700">
                  Contact your system administrator to request the necessary permissions for this module.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
