import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, MessageSquare, TrendingUp, Calendar, ChevronRight, BarChart2 } from 'lucide-react';
import { interactionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface RecruiterStat {
  id: number;
  name: string;
  email: string;
  role: string;
  today_calls: number;
  today_interested: number;
  today_no_response: number;
  today_follow_ups: number;
  total_notes: number;
}

function RecruiterDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    interactionAPI.getRecruiterActivity(userId).then(res => {
      if (res.success) setData(res.data);
    }).finally(() => setLoading(false));
  }, [userId]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: 9999 }}>
      <div 
        className="absolute inset-0 bg-black/30 transition-opacity duration-300" 
        style={{ 
          zIndex: 9998,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}
        onClick={onClose} 
      />
      <div 
        className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col overflow-hidden"
        style={{
          zIndex: 9999,
          animation: 'slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.12), -4px 0 16px rgba(0, 0, 0, 0.08)'
        }}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {loading ? 'Loading…' : data?.user?.name}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Today's stats */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Today's Activity</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Calls',  value: data.snapshots?.[0]?.total_calls  || 0, color: 'text-indigo-600' },
                  { label: 'Interested',   value: data.snapshots?.[0]?.interested   || 0, color: 'text-green-600' },
                  { label: 'No Response',  value: data.snapshots?.[0]?.no_response  || 0, color: 'text-gray-500' },
                  { label: 'Follow-ups',   value: data.snapshots?.[0]?.follow_ups   || 0, color: 'text-blue-600' },
                ].map(m => (
                  <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                    <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 14-day snapshot chart (simple bars) */}
            {data.snapshots?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <BarChart2 size={14} /> Last 14 Days
                </h4>
                <div className="flex items-end gap-1 h-20">
                  {[...data.snapshots].reverse().slice(0, 14).map((s: any) => {
                    const max = Math.max(...data.snapshots.map((x: any) => x.total_calls), 1);
                    const h = Math.round((s.total_calls / max) * 64);
                    return (
                      <div key={s.snap_date} className="flex-1 flex flex-col items-center gap-1" title={`${s.snap_date}: ${s.total_calls} calls`}>
                        <div className="w-full bg-indigo-500 rounded-t" style={{ height: `${h}px`, minHeight: '2px' }} />
                        <span className="text-[9px] text-gray-400 rotate-45 origin-left">
                          {new Date(s.snap_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent notes */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Interactions</h4>
              {data.recentNotes?.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No interactions yet</p>
              ) : (
                <div className="space-y-2">
                  {data.recentNotes?.slice(0, 20).map((n: any) => (
                    <div key={n.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800">{n.candidate_name}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone size={10} /> {n.phone}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{n.note}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-indigo-600 font-medium">{n.status}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(n.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-400 py-16">Failed to load data</p>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

export default function RecruiterMonitor() {
  const { user } = useAuth();
  const [recruiters, setRecruiters] = useState<RecruiterStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== 'Admin') return;
    interactionAPI.getAdminRecruiters().then(res => {
      if (res.success) setRecruiters(res.data as any || []);
    }).finally(() => setLoading(false));
  }, [user]);

  if (user?.role !== 'Admin') return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recruiter Activity Monitor</h1>
        <p className="text-gray-500 text-sm mt-0.5">Real-time view of recruiter interactions and daily performance</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recruiters.map(r => (
            <div key={r.id}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => setSelectedId(r.id)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{r.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{r.role} · {r.email}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-500 transition-colors mt-1" />
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { label: 'Calls',      value: r.today_calls,       color: 'text-indigo-600' },
                  { label: 'Interested', value: r.today_interested,  color: 'text-green-600' },
                  { label: 'No Resp.',   value: r.today_no_response, color: 'text-gray-500' },
                  { label: 'Follow-up',  value: r.today_follow_ups,  color: 'text-blue-600' },
                ].map(m => (
                  <div key={m.label} className="text-center">
                    <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-[10px] text-gray-400">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <MessageSquare size={11} /> {r.total_notes} total notes
                </span>
                <span className="text-xs text-indigo-600 font-medium">View details →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedId && (
        <RecruiterDrawer userId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
