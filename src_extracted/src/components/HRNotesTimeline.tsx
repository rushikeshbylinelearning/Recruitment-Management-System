import { useEffect, useState } from 'react';
import { Phone, Mail, Calendar, ArrowRight, Clock, FileText, User, AlertCircle } from 'lucide-react';
import { hrNotesAPI, HRNote, HRNotesByStage } from '../services/api';

interface HRNotesTimelineProps {
  candidateId: string;
}

// Stage order for timeline display
const STAGE_ORDER = [
  'Applied',
  'Follow Up',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'On Hold',
  'Rejected',
  'No Show - Interview',
  'No Show - Onboarding',
  'Last Minute Back Out',
  'Profile Not Matched',
];

// Stage colors matching the Kanban board
const STAGE_COLORS: Record<string, string> = {
  Applied: '#dc2626',
  Screening: '#f59e0b',
  Interview: '#f97316',
  Offer: '#8b5cf6',
  Hired: '#10b981',
  Rejected: '#ef4444',
  'On Hold': '#6b7280',
  'No Show - Interview': '#ea580c',
  'No Show - Onboarding': '#ec4899',
  'Last Minute Back Out': '#dc2626',
  'Profile Not Matched': '#9333ea',
  'Follow Up': '#0891b2',
};

// Interaction type icons and colors
const INTERACTION_ICONS: Record<string, { icon: any; color: string }> = {
  'Phone Call': { icon: Phone, color: '#10b981' },
  'Email': { icon: Mail, color: '#3b82f6' },
  'Interview': { icon: Calendar, color: '#f59e0b' },
  'Stage Change': { icon: ArrowRight, color: '#8b5cf6' },
  'General Note': { icon: FileText, color: '#6b7280' },
  'System Event': { icon: AlertCircle, color: '#dc2626' },
};

export default function HRNotesTimeline({ candidateId }: HRNotesTimelineProps) {
  const [notesByStage, setNotesByStage] = useState<HRNotesByStage>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHRNotes();
  }, [candidateId]);

  const loadHRNotes = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await hrNotesAPI.getCandidateHRNotes(candidateId);
      
      if (response.success && response.data) {
        setNotesByStage(response.data.notesByStage || {});
      } else {
        setError('Failed to load HR notes');
      }
    } catch (err) {
      console.error('Error loading HR notes:', err);
      setError('Failed to load HR notes');
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
    return time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getInteractionIcon = (type: string) => {
    const config = INTERACTION_ICONS[type] || INTERACTION_ICONS['General Note'];
    const Icon = config.icon;
    return <Icon size={14} style={{ color: config.color }} />;
  };

  const getInteractionBadgeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      'Phone Call': 'bg-green-100 text-green-700 border-green-200',
      'Email': 'bg-blue-100 text-blue-700 border-blue-200',
      'Interview': 'bg-orange-100 text-orange-700 border-orange-200',
      'Stage Change': 'bg-purple-100 text-purple-700 border-purple-200',
      'General Note': 'bg-gray-100 text-gray-700 border-gray-200',
      'System Event': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    };
    return colorMap[type] || colorMap['General Note'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading HR notes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-red-400 mb-3" />
        <p className="text-red-600 text-sm font-medium">{error}</p>
        <button
          onClick={loadHRNotes}
          className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  // Filter stages that have notes and sort by stage order
  const stagesWithNotes = STAGE_ORDER.filter(stage => 
    notesByStage[stage] && notesByStage[stage].length > 0
  );

  if (stagesWithNotes.length === 0) {
    return (
      <div className="text-center py-16">
        <Clock size={56} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 text-base font-medium">No HR notes yet</p>
        <p className="text-gray-400 text-sm mt-2">
          Notes will appear here as interactions are logged and stages change
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">HR Notes Timeline</h3>
        <button
          onClick={loadHRNotes}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {stagesWithNotes.map((stage, stageIndex) => {
        const notes = notesByStage[stage] || [];
        const stageColor = STAGE_COLORS[stage] || '#6b7280';
        
        return (
          <div key={stage} className="relative">
            {/* Stage Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm"
                style={{
                  backgroundColor: `${stageColor}15`,
                  color: stageColor,
                  border: `1.5px solid ${stageColor}40`
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: stageColor }}
                />
                {stage}
              </div>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">
                {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              </span>
            </div>

            {/* Notes for this stage */}
            <div className="space-y-3 ml-4">
              {notes.map((note, noteIndex) => (
                <div key={note.id} className="flex gap-3">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center shadow-sm"
                      style={{ borderColor: `${stageColor}60` }}
                    >
                      {getInteractionIcon(note.interaction_type)}
                    </div>
                    {noteIndex < notes.length - 1 && (
                      <div
                        className="w-0.5 flex-1 mt-2"
                        style={{
                          background: `linear-gradient(to bottom, ${stageColor}40, ${stageColor}10)`,
                          minHeight: '24px'
                        }}
                      />
                    )}
                  </div>

                  {/* Note content */}
                  <div className="flex-1 pb-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                      {/* Note header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getInteractionBadgeColor(note.interaction_type)}`}
                          >
                            {getInteractionIcon(note.interaction_type)}
                            {note.interaction_type}
                          </span>
                          {note.author_name && (
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <User size={12} />
                              <span className="font-medium">{note.author_name}</span>
                              {note.author_role && (
                                <span className="text-gray-400">({note.author_role})</span>
                              )}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {getTimeAgo(note.created_at)}
                        </span>
                      </div>

                      {/* Note text */}
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {note.note_text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Connector to next stage */}
            {stageIndex < stagesWithNotes.length - 1 && (
              <div className="flex items-center gap-3 my-6 ml-4">
                <div className="w-8 flex justify-center">
                  <ArrowRight size={20} className="text-gray-300" />
                </div>
                <div className="flex-1 h-px border-t-2 border-dashed border-gray-200" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}