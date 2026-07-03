import { useEffect, useRef } from 'react';
import { X, ChevronDown, SlidersHorizontal, Upload, UserPlus, FileSpreadsheet, FileText } from 'lucide-react';

export interface FilterState {
  search: string;
  stages: string[];
  role: string;
  location: string;
  source: string;
  experienceMin: string;
  experienceMax: string;
  expectedCtcMin: string;
  expectedCtcMax: string;
  currentCtcMin: string;
  currentCtcMax: string;
  immediateJoiner: boolean;
  noticePeriod: string;
  appliedDateFrom: string;
  appliedDateTo: string;
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  stages: [],
  role: '',
  location: '',
  source: '',
  experienceMin: '',
  experienceMax: '',
  expectedCtcMin: '',
  expectedCtcMax: '',
  currentCtcMin: '',
  currentCtcMax: '',
  immediateJoiner: false,
  noticePeriod: '',
  appliedDateFrom: '',
  appliedDateTo: '',
};

interface FilterPanelProps {
  open: boolean;
  filters: FilterState;
  stages: string[];
  onClose: () => void;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  hasCreatePermission: boolean;
  onImport: () => void;
  onAddCandidate: () => void;
  totalCandidates: number;
  onExportExcel: () => void;
  onExportPdf: () => void;
  exportLoading: boolean;
  canExport?: boolean;
}

export default function FilterPanel({ 
  open, 
  filters, 
  stages, 
  onClose, 
  onChange, 
  onReset,
  hasCreatePermission,
  onImport,
  onAddCandidate,
  totalCandidates,
  onExportExcel,
  onExportPdf,
  exportLoading,
  canExport = true
}: FilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleStage = (stage: string) => {
    const next = filters.stages.includes(stage)
      ? filters.stages.filter((s) => s !== stage)
      : [...filters.stages, stage];
    set('stages', next);
  };

  const activeCount = [
    filters.search,
    filters.stages.length > 0,
    filters.role,
    filters.location,
    filters.source,
    filters.experienceMin,
    filters.experienceMax,
    filters.expectedCtcMin,
    filters.expectedCtcMax,
    filters.currentCtcMin,
    filters.currentCtcMax,
    filters.immediateJoiner,
    filters.noticePeriod,
    filters.appliedDateFrom,
    filters.appliedDateTo,
  ].filter(Boolean).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 h-full z-50 w-96 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <SlidersHorizontal size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Filters</h3>
              <p className="text-xs text-gray-500">{totalCandidates} candidates</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Action Buttons */}
        {hasCreatePermission && (
          <div className="px-6 py-4 border-b border-gray-100 bg-white space-y-2">
            <button
              onClick={() => { onAddCandidate(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
            >
              <UserPlus size={16} />
              <span>Add Candidate</span>
            </button>
            <button
              onClick={() => { onImport(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload size={16} />
              <span>Import Candidates</span>
            </button>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Search */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Search</label>
            <input
              type="text"
              placeholder="Name, email, phone, role..."
              value={filters.search}
              onChange={(e) => set('search', e.target.value)}
              className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white shadow-sm"
            />
          </div>

          {/* Stage */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Stage</label>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <button
                  key={stage}
                  onClick={() => toggleStage(stage)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                    filters.stages.includes(stage)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50'
                  }`}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Role</label>
            <input
              type="text"
              placeholder="e.g. Software Engineer, Designer..."
              value={filters.role}
              onChange={(e) => set('role', e.target.value)}
              className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white shadow-sm"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Location</label>
            <input
              type="text"
              placeholder="City or region"
              value={filters.location}
              onChange={(e) => set('location', e.target.value)}
              className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white shadow-sm"
            />
          </div>

          {/* Source */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Source</label>
            <div className="relative">
              <select
                value={filters.source}
                onChange={(e) => set('source', e.target.value)}
                className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white appearance-none pr-10 shadow-sm"
              >
                <option value="">All sources</option>
                <option value="Manual Entry">Manual Entry</option>
                <option value="Referral">Referral</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Job Portal">Job Portal</option>
                <option value="Campus">Campus</option>
                <option value="Walk-in">Walk-in</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Applied Date */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Applied Date</label>
            <div className="flex gap-3">
              <input
                type="date"
                value={filters.appliedDateFrom}
                onChange={(e) => set('appliedDateFrom', e.target.value)}
                className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
              />
              <input
                type="date"
                value={filters.appliedDateTo}
                onChange={(e) => set('appliedDateTo', e.target.value)}
                className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
              />
            </div>
          </div>

          {/* Experience */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Experience (years)</label>
            <div className="flex gap-3">
              <input
                type="number"
                placeholder="Min"
                min={0}
                value={filters.experienceMin}
                onChange={(e) => set('experienceMin', e.target.value)}
                className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
              />
              <input
                type="number"
                placeholder="Max"
                min={0}
                value={filters.experienceMax}
                onChange={(e) => set('experienceMax', e.target.value)}
                className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
              />
            </div>
          </div>

          {/* Expected CTC */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Expected CTC</label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Min"
                value={filters.expectedCtcMin}
                onChange={(e) => set('expectedCtcMin', e.target.value)}
                className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
              />
              <input
                type="text"
                placeholder="Max"
                value={filters.expectedCtcMax}
                onChange={(e) => set('expectedCtcMax', e.target.value)}
                className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
              />
            </div>
          </div>

          {/* Current CTC */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Current CTC</label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Min"
                value={filters.currentCtcMin}
                onChange={(e) => set('currentCtcMin', e.target.value)}
                className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
              />
              <input
                type="text"
                placeholder="Max"
                value={filters.currentCtcMax}
                onChange={(e) => set('currentCtcMax', e.target.value)}
                className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
              />
            </div>
          </div>

          {/* Availability */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Availability</label>
            <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div
                onClick={() => set('immediateJoiner', !filters.immediateJoiner)}
                className={`w-11 h-6 rounded-full transition-all relative shadow-inner ${
                  filters.immediateJoiner ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                    filters.immediateJoiner ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">Immediate Joiner</span>
            </label>
            <div className="relative">
              <select
                value={filters.noticePeriod}
                onChange={(e) => set('noticePeriod', e.target.value)}
                className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white appearance-none pr-10 shadow-sm"
              >
                <option value="">Any notice period</option>
                <option value="Immediate">Immediate</option>
                <option value="15 days">15 days</option>
                <option value="30 days">30 days</option>
                <option value="60 days">60 days</option>
                <option value="90 days">90 days</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-gray-100 bg-gray-50 space-y-2">
          {canExport && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onExportExcel}
                disabled={exportLoading}
                className="w-full py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <FileSpreadsheet size={15} />
                <span>Download Excel</span>
              </button>
              <button
                onClick={onExportPdf}
                disabled={exportLoading}
                className="w-full py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <FileText size={15} />
                <span>Download PDF</span>
              </button>
            </div>
          )}
          {activeCount > 0 && (
            <button
              onClick={onReset}
              className="w-full py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
            >
              Clear All Filters
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}
