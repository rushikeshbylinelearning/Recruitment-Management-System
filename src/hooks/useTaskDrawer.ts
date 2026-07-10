import { useState, useCallback } from 'react';

export type DrawerTab = 'overview' | 'checklist' | 'notes' | 'files' | 'comments' | 'activity' | 'history';

interface UseTaskDrawerReturn {
  isOpen: boolean;
  activeTaskId: number | null;
  activeTab: DrawerTab;
  openTask: (taskId: number, tab?: DrawerTab) => void;
  closeDrawer: () => void;
  setActiveTab: (tab: DrawerTab) => void;
}

export function useTaskDrawer(): UseTaskDrawerReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');

  const openTask = useCallback((taskId: number, tab: DrawerTab = 'overview') => {
    setActiveTaskId(taskId);
    setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    setActiveTaskId(null);
  }, []);

  return {
    isOpen,
    activeTaskId,
    activeTab,
    openTask,
    closeDrawer,
    setActiveTab,
  };
}
