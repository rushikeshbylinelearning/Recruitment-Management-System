import { useState, useEffect, useRef } from 'react';
import { Star, Phone, User, Mail, FileText, Calendar, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { interactionAPI, candidatesAPI, InteractionNote } from '../services/api';
import LeftDrawer from './ui/LeftDrawer';
import RightDrawer from './ui/RightDrawer';
import { useDrawer } from '../contexts/DrawerContext';
import { useNavigate } from 'react-router-dom';

interface Props {
  onClose: () => void;
  prefillPhone?: string;
}

const STATUSES = ['Not Interested', 'Interested', 'Follow-up', 'No Response', 'Wrong Number'] as const;
const SOURCES  = ['Manual', 'Indeed', 'Naukri', 'Monster', 'Referral'] as const;

export default function InteractionNoteModal({ onClose, prefillPhone }: Props) {
  const { isHistoryOpen } = useDrawer();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', phone: prefillPhone || '', email: '',
    source: 'Manual', note: '', priority: 3,
    status: 'No Response', follow_up_date: ''
  });
  const [existingCandidate, setExistingCandidate] = useState<any>(null);
  const [latestNote, setLatestNote] = useState<InteractionNote | null>(null);
  const [existingPipelineCandidate, setExistingPipelineCandidate] = useState<any>(null);
  const [pipelineLatestNote, setPipelineLatestNote] = useState<any>(null);
  const [phoneChecked, setPhoneChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-check phone after user stops typing
  useEffect(() => {
    if (!form.phone || form.phone.length < 7) {
      setExistingCandidate(null);
      setLatestNote(null);
      setExistingPipelineCandidate(null);
      setPipelineLatestNote(null);
      setPhoneChecked(false);
      return;
    }
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(async () => {
      try {
        // Check interaction_candidates table
        const interactionRes = await interactionAPI.checkPhone(form.phone);
        if (interactionRes.exists && interactionRes.data) {
          setExistingCandidate(interactionRes.data);
          setLatestNote(interactionRes.latestNote || null);
          setForm(f => ({ ...f, name: interactionRes.data!.name, email: interactionRes.data!.email || '' }));
        } else {
          setExistingCandidate(null);
          setLatestNote(null);
        }

        // Check main candidates table (pipeline)
        const pipelineRes = await candidatesAPI.checkByPhone(form.phone);
        if (pipelineRes.exists && pipelineRes.data) {
          setExistingPipelineCandidate(pipelineRes.data);
          setPipelineLatestNote(pipelineRes.latestNote || null);
          // If no interaction candidate, prefill from pipeline candidate
          if (!interactionRes.exists) {
            setForm(f => ({ 
              ...f, 
              name: pipelineRes.data!.name, 
              email: pipelineRes.data!.email || '' 
            }));
          }
        } else {
          setExistingPipelineCandidate(null);
          setPipelineLatestNote(null);
        }

        setPhoneChecked(true);
      } catch { /* silent */ }
    }, 600);
    return () => { if (phoneTimer.current) clearTimeout(phoneTimer.current); };
  }, [form.phone]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const setNoteWithCaret = (nextNote: string, caretPos: number) => {
    setForm(f => ({ ...f, note: nextNote }));
    requestAnimationFrame(() => {
      const el = noteRef.current;
      if (!el) return;
      el.setSelectionRange(caretPos, caretPos);
    });
  };

  const handleNoteKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key !== '.' || e.metaKey || e.ctrlKey || e.altKey) return;

    const el = e.currentTarget;
    const value = el.value;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;

    const beforeRaw = value.slice(0, start);
    const after = value.slice(end);

    const lineStart = beforeRaw.lastIndexOf('\n') + 1;
    const beforeLine = beforeRaw.slice(0, lineStart);
    const lineSoFar = beforeRaw.slice(lineStart);

    const trimmedLine = lineSoFar.trimStart();
    const hasBulletPrefix = trimmedLine.startsWith('• ') || trimmedLine.startsWith('- ');
    const isMeaningful = lineSoFar.trim().length > 0;

    // Only auto-bullet when this looks like a real sentence end.
    if (!isMeaningful) return;
    if (lineSoFar.trim().length < 3) return;
    if (lineSoFar.trimEnd().endsWith('.')) return;

    e.preventDefault();

    let before = beforeRaw;
    let caret = start;
    if (!hasBulletPrefix) {
      before = beforeLine + '• ' + lineSoFar;
      caret += 2;
    }

    const insertion = '.\n• ';
    const next = before + insertion + after;
    const nextCaret = caret + insertion.length;
    setNoteWithCaret(next, nextCaret);
  };

  const handleSave = async () => {
    // Validate that at least one contact method exists
    if (!form.phone.trim() && !form.email.trim()) { 
      setError('At least one contact method (phone or email) is required'); 
      return; 
    }
    if (!form.note.trim())  { setError('Note is required'); return; }
    setError('');
    setSaving(true);
    try {
      const response = await interactionAPI.addOrUpdate({
        name: form.name, phone: form.phone, email: form.email || undefined,
        source: form.source, note: form.note, priority: form.priority,
        status: form.status, follow_up_date: form.follow_up_date || undefined
      });
      
      // Display success message with candidate info
      if (response.mainCandidate) {
        const candidateInfo = response.mainCandidate;
        setSuccessMessage(
          `Interaction logged! Candidate ${candidateInfo.name} is now in ${candidateInfo.stage} stage.`
        );
      } else {
        setSuccessMessage('Interaction logged successfully!');
      }
      
      setSaved(true);
      
      // Refresh interaction list by triggering a custom event
      window.dispatchEvent(new CustomEvent('interaction-saved'));
      
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Use LeftDrawer when history is open, otherwise use RightDrawer
  const DrawerComponent = isHistoryOpen ? LeftDrawer : RightDrawer;

  return (
    <DrawerComponent
      isOpen={true}
      onClose={onClose}
      title="Log Interaction"
      subtitle="Track every call, follow-up, and note"
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`px-6 py-2.5 text-sm font-medium rounded-xl transition-all shadow-sm ${
              saved
                ? 'bg-green-600 text-white shadow-green-200'
                : saving
                ? 'bg-indigo-400 text-white cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-indigo-200 hover:shadow-md'
            }`}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Interaction'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
          {/* Existing pipeline candidate warning */}
          {phoneChecked && existingPipelineCandidate && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3.5 animate-slideIn">
              <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-blue-800">This candidate is already in the pipeline</p>
                <div className="mt-1.5 space-y-1">
                  <p className="text-blue-700 text-xs">
                    <span className="font-medium">Name:</span> {existingPipelineCandidate.name}
                  </p>
                  <p className="text-blue-700 text-xs">
                    <span className="font-medium">Stage:</span> {existingPipelineCandidate.stage}
                  </p>
                  {existingPipelineCandidate.position && (
                    <p className="text-blue-700 text-xs">
                      <span className="font-medium">Position:</span> {existingPipelineCandidate.position}
                    </p>
                  )}
                  {pipelineLatestNote && (
                    <p className="text-blue-700 text-xs mt-2 leading-relaxed">
                      <span className="font-medium">Last note ({new Date(pipelineLatestNote.created_at).toLocaleDateString()}):</span>&nbsp;
                      <span className="italic">"{pipelineLatestNote.note_text.slice(0, 80)}{pipelineLatestNote.note_text.length > 80 ? '…' : ''}"</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    navigate(`/candidates?id=${existingPipelineCandidate.id}`);
                    onClose();
                  }}
                  className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-100 transition-all"
                >
                  <ExternalLink size={12} /> View in Pipeline
                </button>
              </div>
            </div>
          )}

          {/* Existing interaction candidate banner */}
          {phoneChecked && existingCandidate && !existingPipelineCandidate && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 animate-slideIn">
              <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">This candidate was previously contacted</p>
                {latestNote && (
                  <p className="text-amber-700 mt-1 text-xs leading-relaxed">
                    Last note ({new Date(latestNote.created_at).toLocaleDateString()}):&nbsp;
                    <span className="italic">"{latestNote.note.slice(0, 80)}{latestNote.note.length > 80 ? '…' : ''}"</span>
                  </p>
                )}
              </div>
            </div>
          )}
          {phoneChecked && !existingCandidate && !existingPipelineCandidate && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 animate-slideIn">
              <CheckCircle size={15} /> New candidate
            </div>
          )}

          {/* Phone */}
          <div className="animate-slideIn" style={{ animationDelay: '50ms' }}>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Phone Number <span className="text-gray-500 text-xs">(required if no email)</span>
            </label>
            <div className="relative group">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:border-gray-400"
              />
            </div>
          </div>

          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-3 animate-slideIn" style={{ animationDelay: '100ms' }}>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Candidate Name
              </label>
              <div className="relative group">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Optional (auto-generated if empty)"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:border-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative group">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="optional"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:border-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Source + Status */}
          <div className="grid grid-cols-2 gap-3 animate-slideIn" style={{ animationDelay: '150ms' }}>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Source</label>
              <select
                value={form.source}
                onChange={e => set('source', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all hover:border-gray-400"
              >
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all hover:border-gray-400"
              >
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Priority stars */}
          <div className="animate-slideIn" style={{ animationDelay: '200ms' }}>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Priority</label>
            <div className="flex gap-1.5">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set('priority', n)}
                  className="focus:outline-none transition-all hover:scale-110 active:scale-95"
                >
                  <Star
                    size={24}
                    className={`transition-all ${
                      n <= form.priority
                        ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                        : 'text-gray-300 hover:text-gray-400'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="animate-slideIn" style={{ animationDelay: '250ms' }}>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Notes Section <span className="text-red-500">*</span>
            </label>
            <div className="relative group">
              <FileText size={15} className="absolute left-3 top-3 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <textarea
                ref={noteRef}
                value={form.note}
                onChange={e => set('note', e.target.value)}
                onKeyDown={handleNoteKeyDown}
                rows={4}
                placeholder="Write notes. End a sentence with “.” to auto-create bullets…"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 resize-none transition-all hover:border-gray-400 leading-relaxed"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Tip: type a sentence and press <span className="font-medium">.</span> to start the next bullet automatically.
            </p>
          </div>

          {/* Follow-up date */}
          {(form.status === 'Follow-up' || form.status === 'Interested') && (
            <div className="animate-slideIn" style={{ animationDelay: '300ms' }}>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Follow-up Date</label>
              <div className="relative group">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="date"
                  value={form.follow_up_date}
                  onChange={e => set('follow_up_date', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all hover:border-gray-400"
                />
              </div>
            </div>
          )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 animate-slideIn">
            {error}
          </p>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3.5 py-2.5 text-sm text-green-700 animate-slideIn">
            <CheckCircle size={16} className="flex-shrink-0" />
            <p>{successMessage}</p>
          </div>
        )}
      </div>
    </DrawerComponent>
  );
}
