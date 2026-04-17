import { useDrawer } from '../contexts/DrawerContext';
import InteractionNoteModal from './InteractionNoteModal';

/**
 * Global drawer manager that renders drawers based on global state
 * This component should be placed at the root level of the app
 */
export default function GlobalDrawerManager() {
  const { isLogOpen, closeLogInteraction, logPrefillPhone } = useDrawer();

  return (
    <>
      {/* Log Interaction Drawer - Context-aware positioning */}
      {isLogOpen && (
        <InteractionNoteModal
          prefillPhone={logPrefillPhone}
          onClose={closeLogInteraction}
        />
      )}
    </>
  );
}
