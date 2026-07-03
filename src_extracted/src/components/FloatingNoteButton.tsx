import { MessageSquarePlus } from 'lucide-react';
import { useDrawer } from '../contexts/DrawerContext';

export default function FloatingNoteButton() {
  const { openLogInteraction } = useDrawer();

  return (
    <button
      onClick={() => openLogInteraction()}
      title="Log candidate interaction"
      className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
    >
      <MessageSquarePlus size={20} />
      <span className="text-sm font-medium hidden sm:inline">Log Interaction</span>
    </button>
  );
}
