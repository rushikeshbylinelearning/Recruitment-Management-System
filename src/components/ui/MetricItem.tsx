import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricItemProps {
  title: string;
  value: number;
  date: string; // ISO date string
  icon?: LucideIcon;
  meta?: Record<string, any>;
  onClick?: () => void;
}

export default function MetricItem({ title, value, date, icon: Icon, onClick }: MetricItemProps) {
  // Format date to readable format (e.g., "May 5, 2026")
  const formatDate = (dateString: string) => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div 
      className={`flex items-start space-x-3 p-3 rounded-xl transition-all ${
        onClick ? 'hover:bg-gray-50 cursor-pointer group' : ''
      }`}
      onClick={onClick}
    >
      <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 group-hover:scale-125 transition-transform flex-shrink-0"></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline space-x-2">
          <span className="text-lg font-bold text-gray-900">{value}</span>
          <span className="text-sm text-gray-700 font-medium">{title}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{formatDate(date)}</p>
      </div>
      {Icon && (
        <Icon size={16} className="text-gray-400 mt-1 flex-shrink-0" />
      )}
    </div>
  );
}
