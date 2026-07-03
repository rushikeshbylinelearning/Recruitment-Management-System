/**
 * Umbrella Stage Demo Component
 * 
 * This component demonstrates the umbrella stage system
 * with sample data for testing and showcasing.
 * 
 * Usage:
 * import UmbrellaStageDemo from './components/kanban/UmbrellaStageDemo';
 * <UmbrellaStageDemo />
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Info, Play, X } from 'lucide-react';
import KanbanBoard from './KanbanBoard';
import { Candidate as ApiCandidate } from '../../services/api';

// Sample candidates for demo
const DEMO_CANDIDATES: ApiCandidate[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    position: 'Senior Developer',
    stage: 'Rejected',
    appliedDate: '2026-05-01',
    location: 'New York',
    experience: '5 years',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1234567891',
    position: 'Product Manager',
    stage: 'On Hold',
    appliedDate: '2026-05-02',
    location: 'San Francisco',
    experience: '7 years',
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    phone: '+1234567892',
    position: 'UX Designer',
    stage: 'Profile Not Matched',
    appliedDate: '2026-05-03',
    location: 'Austin',
    experience: '3 years',
  },
  {
    id: '4',
    name: 'Alice Williams',
    email: 'alice@example.com',
    phone: '+1234567893',
    position: 'Data Scientist',
    stage: 'Last Minute Back Out',
    appliedDate: '2026-05-04',
    location: 'Seattle',
    experience: '4 years',
  },
  {
    id: '5',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    phone: '+1234567894',
    position: 'DevOps Engineer',
    stage: 'Applied',
    appliedDate: '2026-05-05',
    location: 'Boston',
    experience: '6 years',
  },
  {
    id: '6',
    name: 'Diana Prince',
    email: 'diana@example.com',
    phone: '+1234567895',
    position: 'Marketing Manager',
    stage: 'Interview',
    appliedDate: '2026-05-06',
    location: 'Chicago',
    experience: '8 years',
  },
];

const STAGES = [
  'Applied',
  'Follow Up',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'On Hold',
  'Rejected',
  'Last Minute Back Out',
  'Profile Not Matched',
];

export default function UmbrellaStageDemo() {
  const [showDemo, setShowDemo] = useState(false);
  const [candidates, setCandidates] = useState<ApiCandidate[]>(DEMO_CANDIDATES);
  const [showInstructions, setShowInstructions] = useState(true);

  const candidatesByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = candidates.filter((c) => c.stage === stage);
    return acc;
  }, {} as Record<string, ApiCandidate[]>);

  const handleStageChange = async (candidateId: string, newStage: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId ? { ...c, stage: newStage as ApiCandidate['stage'] } : c
      )
    );
  };

  if (!showDemo) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          onClick={() => setShowDemo(true)}
          className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Play size={20} />
          <span className="font-medium">Try Umbrella Stage Demo</span>
        </motion.button>
      </div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-7xl h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
              <Info size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Umbrella Stage Demo
              </h2>
              <p className="text-sm text-gray-600">
                Click the "Rejected" column to see the magic ✨
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDemo(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Instructions Panel */}
        {showInstructions && (
          <motion.div
            className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">
                  🎯 How to Use
                </h3>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>
                    <strong>1.</strong> Click the <strong>"Rejected"</strong> column
                    header
                  </li>
                  <li>
                    <strong>2.</strong> Watch the smooth Apple-style expansion
                    animation
                  </li>
                  <li>
                    <strong>3.</strong> Drag candidates between sub-stages (Rejected,
                    On Hold, etc.)
                  </li>
                  <li>
                    <strong>4.</strong> Press <kbd className="px-2 py-0.5 bg-white rounded border border-blue-300">ESC</kbd> or click outside to close
                  </li>
                  <li>
                    <strong>5.</strong> Notice the spatial continuity and smooth
                    transitions
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Got it
              </button>
            </div>
          </motion.div>
        )}

        {/* Demo Board */}
        <div className="flex-1 p-6 overflow-hidden">
          <KanbanBoard
            stages={STAGES}
            candidatesByStage={candidatesByStage}
            onStageChange={handleStageChange}
            onCandidateClick={() => {}}
            onCandidateEdit={() => {}}
            onCandidateDelete={() => {}}
            onDownloadResume={() => {}}
            hasEditPermission={true}
            hasDeletePermission={true}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Demo Mode</span> • Sample data only
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Built with Framer Motion + DND Kit
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
