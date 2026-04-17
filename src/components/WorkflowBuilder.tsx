import { useState, useEffect } from 'react';
import { Plus, Trash2, Power, Edit, ChevronRight, Zap, GitBranch, Play, X, Check, Activity } from 'lucide-react';
import { workflowsAPI, Workflow, WorkflowTrigger, WorkflowCondition, WorkflowAction } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_EVENTS = [
  { value: 'stage_change',        label: 'Candidate Stage Change',    entity: 'candidate' },
  { value: 'created',             label: 'Candidate Created',         entity: 'candidate' },
  { value: 'interview_scheduled', label: 'Interview Scheduled',       entity: 'interview' },
  { value: 'task_completed',      label: 'Task Completed',            entity: 'candidate' },
];

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'On Hold', 'Rejected', 'No Show - Interview', 'No Show - Onboarding'];

const CONDITION_FIELDS = [
  { value: 'stage',       label: 'Current Stage' },
  { value: 'experience',  label: 'Experience (years)' },
  { value: 'position',    label: 'Position' },
  { value: 'source',      label: 'Source' },
  { value: 'location',    label: 'Location' },
  { value: 'expertise',   label: 'Expertise' },
];

const OPERATORS = [
  { value: '=',           label: 'equals' },
  { value: '!=',          label: 'not equals' },
  { value: '>',           label: 'greater than' },
  { value: '<',           label: 'less than' },
  { value: '>=',          label: 'greater or equal' },
  { value: '<=',          label: 'less or equal' },
  { value: 'contains',    label: 'contains' },
  { value: 'not_contains',label: 'does not contain' },
];

const ACTION_TYPES = [
  { value: 'email',        label: '📧 Send Email',         color: 'bg-blue-100 text-blue-800' },
  { value: 'task',         label: '✅ Create Task',         color: 'bg-green-100 text-green-800' },
  { value: 'interview',    label: '📅 Schedule Interview',  color: 'bg-orange-100 text-orange-800' },
  { value: 'webhook',      label: '🔗 Webhook',             color: 'bg-purple-100 text-purple-800' },
  { value: 'stage_change', label: '🔄 Change Stage',        color: 'bg-yellow-100 text-yellow-800' },
];

// ─── Empty state factories ────────────────────────────────────────────────────

const emptyTrigger = (): WorkflowTrigger => ({ entity_type: 'candidate', event_type: 'stage_change', config: {} });
const emptyCondition = (): WorkflowCondition => ({ field: 'stage', operator: '=', value: '', logic_group: 'AND' });
const emptyAction = (order: number): WorkflowAction => ({ action_type: 'email', config: {}, execution_order: order });

// ─── Sub-components ───────────────────────────────────────────────────────────

function TriggerSelector({ trigger, onChange }: { trigger: WorkflowTrigger; onChange: (t: WorkflowTrigger) => void }) {
  const selected = TRIGGER_EVENTS.find(e => e.value === trigger.event_type);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {TRIGGER_EVENTS.map(ev => (
          <button
            key={ev.value}
            onClick={() => onChange({ entity_type: ev.entity as any, event_type: ev.value as any, config: {} })}
            className={`p-3 rounded-xl border-2 text-left transition-all ${
              trigger.event_type === ev.value
                ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
          >
            <div className="font-medium text-sm">{ev.label}</div>
          </button>
        ))}
      </div>

      {trigger.event_type === 'stage_change' && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Stage (optional)</label>
            <select
              value={trigger.config?.from_stage || ''}
              onChange={e => onChange({ ...trigger, config: { ...trigger.config, from_stage: e.target.value || undefined } })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Any stage</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Stage (optional)</label>
            <select
              value={trigger.config?.to_stage || ''}
              onChange={e => onChange({ ...trigger, config: { ...trigger.config, to_stage: e.target.value || undefined } })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Any stage</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function ConditionBuilder({ conditions, onChange }: { conditions: WorkflowCondition[]; onChange: (c: WorkflowCondition[]) => void }) {
  const add = () => onChange([...conditions, emptyCondition()]);
  const remove = (i: number) => onChange(conditions.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<WorkflowCondition>) =>
    onChange(conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  return (
    <div className="space-y-3">
      {conditions.length === 0 && (
        <p className="text-sm text-gray-500 italic">No conditions — workflow runs for all matching events.</p>
      )}
      {conditions.map((cond, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
          <select
            value={cond.logic_group}
            onChange={e => update(i, { logic_group: e.target.value as 'AND' | 'OR' })}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-semibold w-16"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
          <select
            value={cond.field}
            onChange={e => update(i, { field: e.target.value })}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1"
          >
            {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select
            value={cond.operator}
            onChange={e => update(i, { operator: e.target.value as any })}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-36"
          >
            {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
          </select>
          {cond.field === 'stage' ? (
            <select
              value={cond.value}
              onChange={e => update(i, { value: e.target.value })}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1"
            >
              <option value="">Select stage</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input
              value={cond.value}
              onChange={e => update(i, { value: e.target.value })}
              placeholder="Value"
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1"
            />
          )}
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-1">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
        <Plus size={14} /> Add Condition
      </button>
    </div>
  );
}

function ActionConfig({ action, onChange }: { action: WorkflowAction; onChange: (a: WorkflowAction) => void }) {
  const cfg = action.config;
  const set = (patch: Record<string, any>) => onChange({ ...action, config: { ...cfg, ...patch } });

  switch (action.action_type) {
    case 'email':
      return (
        <div className="space-y-2 mt-2">
          <select value={cfg.to || 'candidate'} onChange={e => set({ to: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="candidate">Candidate</option>
            <option value="recruiter">Assigned Recruiter</option>
            <option value="custom">Custom Email</option>
          </select>
          {cfg.to === 'custom' && (
            <input value={cfg.custom_email || ''} onChange={e => set({ custom_email: e.target.value })}
              placeholder="email@example.com" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          )}
          <input value={cfg.subject || ''} onChange={e => set({ subject: e.target.value })}
            placeholder="Subject (use {{candidate_name}}, {{position}}, etc.)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={cfg.body || ''} onChange={e => set({ body: e.target.value })}
            placeholder="Email body..." rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
      );
    case 'task':
      return (
        <div className="space-y-2 mt-2">
          <input value={cfg.title || ''} onChange={e => set({ title: e.target.value })}
            placeholder="Task title (use {{candidate_name}}, etc.)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={cfg.assigned_to || 'recruiter'} onChange={e => set({ assigned_to: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="recruiter">Assigned Recruiter</option>
              <option value="hr_manager">HR Manager</option>
            </select>
            <input type="number" value={cfg.due_in_days || 3} onChange={e => set({ due_in_days: parseInt(e.target.value) })}
              min={1} placeholder="Due in days"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <select value={cfg.priority || 'medium'} onChange={e => set({ priority: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      );
    case 'interview':
      return (
        <div className="space-y-2 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={cfg.type || 'Technical'} onChange={e => set({ type: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {['Technical', 'HR', 'Managerial', 'Final'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" value={cfg.delay_hours || 24} onChange={e => set({ delay_hours: parseInt(e.target.value) })}
              min={1} placeholder="Delay (hours)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={cfg.duration || 60} onChange={e => set({ duration: parseInt(e.target.value) })}
              min={15} placeholder="Duration (min)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="number" value={cfg.round || 1} onChange={e => set({ round: parseInt(e.target.value) })}
              min={1} placeholder="Round #"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      );
    case 'webhook':
      return (
        <div className="mt-2">
          <input value={cfg.url || ''} onChange={e => set({ url: e.target.value })}
            placeholder="https://api.example.com/webhook"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      );
    case 'stage_change':
      return (
        <div className="mt-2">
          <select value={cfg.stage || ''} onChange={e => set({ stage: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Select target stage</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      );
    default:
      return null;
  }
}

function ActionBuilder({ actions, onChange }: { actions: WorkflowAction[]; onChange: (a: WorkflowAction[]) => void }) {
  const add = () => onChange([...actions, emptyAction(actions.length)]);
  const remove = (i: number) => onChange(actions.filter((_, idx) => idx !== i));
  const update = (i: number, a: WorkflowAction) => onChange(actions.map((x, idx) => idx === i ? a : x));

  return (
    <div className="space-y-3">
      {actions.map((action, i) => {
        const typeInfo = ACTION_TYPES.find(t => t.value === action.action_type);
        return (
          <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-gray-400 w-6">{i + 1}</span>
              <select
                value={action.action_type}
                onChange={e => update(i, { ...action, action_type: e.target.value as any, config: {} })}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1"
              >
                {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 size={14} />
              </button>
            </div>
            <ActionConfig action={action} onChange={a => update(i, a)} />
          </div>
        );
      })}
      <button onClick={add} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
        <Plus size={14} /> Add Action
      </button>
    </div>
  );
}

// ─── Workflow Form Modal ──────────────────────────────────────────────────────

interface WorkflowFormProps {
  initial?: Workflow | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

function WorkflowForm({ initial, onSave, onClose }: WorkflowFormProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [trigger, setTrigger] = useState<WorkflowTrigger>(
    (initial as any)?.triggers?.[0] || emptyTrigger()
  );
  const [conditions, setConditions] = useState<WorkflowCondition[]>((initial as any)?.conditions || []);
  const [actions, setActions] = useState<WorkflowAction[]>((initial as any)?.actions || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const steps = ['Trigger', 'Conditions', 'Actions', 'Review'];

  const handleSave = async () => {
    if (!name.trim()) { setError('Workflow name is required'); return; }
    if (actions.length === 0) { setError('At least one action is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name, description, trigger, conditions, actions });
    } catch (err: any) {
      setError(err.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{initial ? 'Edit Workflow' : 'New Workflow'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">IF (Trigger + Conditions) THEN (Actions)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {steps.map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                step === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workflow Name *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Auto-schedule interview on stage change"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What does this workflow do?" rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Event *</label>
                <TriggerSelector trigger={trigger} onChange={setTrigger} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Add conditions to filter when this workflow runs. Leave empty to run for all matching events.
              </p>
              <ConditionBuilder conditions={conditions} onChange={setConditions} />
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Define what happens when the workflow fires. Actions execute in order.
              </p>
              <ActionBuilder actions={actions} onChange={setActions} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-indigo-50 rounded-xl p-4">
                <h4 className="font-semibold text-indigo-900 mb-1">{name}</h4>
                {description && <p className="text-sm text-indigo-700">{description}</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Zap size={14} className="text-yellow-500" />
                  <span className="font-medium">Trigger:</span>
                  <span className="text-gray-600">{TRIGGER_EVENTS.find(e => e.value === trigger.event_type)?.label}</span>
                  {trigger.config?.to_stage && <span className="text-gray-500">→ {trigger.config.to_stage}</span>}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <GitBranch size={14} className="text-blue-500" />
                  <span className="font-medium">Conditions:</span>
                  <span className="text-gray-600">{conditions.length === 0 ? 'None (always runs)' : `${conditions.length} condition(s)`}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Play size={14} className="text-green-500" />
                  <span className="font-medium">Actions:</span>
                  <span className="text-gray-600">{actions.length} action(s): {actions.map(a => ACTION_TYPES.find(t => t.value === a.action_type)?.label).join(', ')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">
            ← Back
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                Next →
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                <Check size={16} />
                {saving ? 'Saving...' : 'Save Workflow'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main WorkflowBuilder Component ──────────────────────────────────────────

export default function WorkflowBuilder() {
  const { hasPermission } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<number | null>(null);
  const [logs, setLogs] = useState<Record<number, any[]>>({});

  useEffect(() => { loadWorkflows(); }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const res = await workflowsAPI.getWorkflows();
      if (res.success && res.data) setWorkflows(res.data.workflows);
      else setError('Failed to load workflows');
    } catch { setError('Failed to load workflows'); }
    finally { setLoading(false); }
  };

  const handleSave = async (data: any) => {
    if (editingWorkflow) {
      await workflowsAPI.updateWorkflow(editingWorkflow.id, data);
    } else {
      await workflowsAPI.createWorkflow(data);
    }
    setShowForm(false);
    setEditingWorkflow(null);
    await loadWorkflows();
  };

  const handleToggle = async (id: number) => {
    const res = await workflowsAPI.toggleWorkflow(id);
    if (res.success) {
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_active: res.data!.is_active } : w));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this workflow?')) return;
    await workflowsAPI.deleteWorkflow(id);
    setWorkflows(prev => prev.filter(w => w.id !== id));
  };

  const handleEdit = async (workflow: Workflow) => {
    const res = await workflowsAPI.getWorkflowById(workflow.id);
    if (res.success && res.data) {
      setEditingWorkflow(res.data.workflow);
      setShowForm(true);
    }
  };

  const toggleLogs = async (id: number) => {
    if (expandedLogs === id) { setExpandedLogs(null); return; }
    setExpandedLogs(id);
    if (!logs[id]) {
      const res = await workflowsAPI.getWorkflowLogs(id, { limit: 20 });
      if (res.success && res.data) setLogs(prev => ({ ...prev, [id]: res.data!.logs }));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Loading workflows...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Zap className="text-indigo-600" size={32} />
            Workflow Automation
          </h1>
          <p className="text-gray-600 mt-1">IF (Trigger + Conditions) THEN (Actions) — runs automatically</p>
        </div>
        {hasPermission('settings', 'edit') && (
          <button
            onClick={() => { setEditingWorkflow(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
          >
            <Plus size={18} />
            <span className="font-semibold">New Workflow</span>
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">{error}</div>}

      {/* Workflow list */}
      <div className="space-y-4">
        {workflows.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <Zap size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg font-medium">No workflows yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first workflow to automate your pipeline</p>
          </div>
        ) : (
          workflows.map(workflow => (
            <div key={workflow.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        workflow.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {workflow.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {workflow.description && <p className="text-sm text-gray-500 mb-3">{workflow.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><GitBranch size={12} /> {workflow.condition_count || 0} conditions</span>
                      <span className="flex items-center gap-1"><Play size={12} /> {workflow.action_count || 0} actions</span>
                      <span className="flex items-center gap-1"><Activity size={12} /> {workflow.execution_count || 0} executions</span>
                      {workflow.last_executed && (
                        <span>Last run: {new Date(workflow.last_executed).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={() => handleToggle(workflow.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        workflow.is_active ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`} title={workflow.is_active ? 'Disable' : 'Enable'}>
                      <Power size={16} />
                    </button>
                    {hasPermission('settings', 'edit') && (
                      <button onClick={() => handleEdit(workflow)}
                        className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200" title="Edit">
                        <Edit size={16} />
                      </button>
                    )}
                    {hasPermission('settings', 'delete') && (
                      <button onClick={() => handleDelete(workflow.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                    <button onClick={() => toggleLogs(workflow.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        expandedLogs === workflow.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`} title="View Logs">
                      <ChevronRight size={16} className={`transition-transform ${expandedLogs === workflow.id ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Execution logs */}
              {expandedLogs === workflow.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Executions</h4>
                  {!logs[workflow.id] ? (
                    <p className="text-sm text-gray-500">Loading...</p>
                  ) : logs[workflow.id].length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No executions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {logs[workflow.id].map(log => (
                        <div key={log.id} className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-2 border border-gray-200">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            log.status === 'success' ? 'bg-green-500' :
                            log.status === 'skipped' ? 'bg-yellow-400' : 'bg-red-500'
                          }`} />
                          <span className="font-medium text-gray-700">{log.candidate_name || `Entity #${log.entity_id}`}</span>
                          <span className="text-gray-500 flex-1">{log.message}</span>
                          <span className="text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info box */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <h4 className="text-indigo-900 font-semibold mb-2 flex items-center gap-2"><Zap size={16} /> How Workflows Work</h4>
        <div className="grid grid-cols-3 gap-4 text-sm text-indigo-800">
          <div><span className="font-medium">1. Trigger</span><br />Event fires (stage change, candidate created, etc.)</div>
          <div><span className="font-medium">2. Conditions</span><br />IF rules evaluated (experience, stage, etc.)</div>
          <div><span className="font-medium">3. Actions</span><br />Email, task, interview, webhook — in order</div>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <WorkflowForm
          initial={editingWorkflow}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingWorkflow(null); }}
        />
      )}
    </div>
  );
}
