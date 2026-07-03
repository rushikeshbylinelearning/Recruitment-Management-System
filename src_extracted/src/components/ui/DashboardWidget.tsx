import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface DashboardWidgetProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'indigo';
  onClick?: () => void;
  children?: ReactNode;
}

export default function DashboardWidget({
  title,
  value,
  icon: Icon,
  trend,
  color = 'blue',
  onClick,
  children
}: DashboardWidgetProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    indigo: 'bg-indigo-500'
  };

  const hoverColorClasses = {
    blue: 'hover:border-blue-300',
    green: 'hover:border-green-300',
    orange: 'hover:border-orange-300',
    purple: 'hover:border-purple-300',
    red: 'hover:border-red-300',
    indigo: 'hover:border-indigo-300'
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all duration-200 ${
        onClick ? `cursor-pointer hover:shadow-lg ${hoverColorClasses[color]} transform hover:-translate-y-1` : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-14 h-14 ${colorClasses[color]} rounded-xl flex items-center justify-center shadow-lg`}>
          <Icon className="text-white" size={28} />
        </div>
      </div>
      
      {trend && (
        <div className="flex items-center space-x-1">
          <span className={`text-sm font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.value}
          </span>
          <span className="text-sm text-gray-500">from last month</span>
        </div>
      )}
      
      {children && <div className="mt-4 pt-4 border-t border-gray-100">{children}</div>}
    </div>
  );
}
