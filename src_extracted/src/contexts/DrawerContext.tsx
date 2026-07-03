import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface DrawerContextType {
  isHistoryOpen: boolean;
  isLogOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  setLogOpen: (open: boolean) => void;
  openLogInteraction: (prefillPhone?: string) => void;
  closeLogInteraction: () => void;
  openHistory: () => void;
  closeHistory: () => void;
  logPrefillPhone?: string;
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [isLogOpen, setLogOpen] = useState(false);
  const [logPrefillPhone, setLogPrefillPhone] = useState<string | undefined>();

  // Manage body scroll lock when any drawer is open
  useEffect(() => {
    if (isHistoryOpen || isLogOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isHistoryOpen, isLogOpen]);

  const openLogInteraction = (prefillPhone?: string) => {
    setLogPrefillPhone(prefillPhone);
    setLogOpen(true);
  };

  const closeLogInteraction = () => {
    setLogOpen(false);
    setLogPrefillPhone(undefined);
  };

  const openHistory = () => {
    setHistoryOpen(true);
  };

  const closeHistory = () => {
    setHistoryOpen(false);
  };

  return (
    <DrawerContext.Provider
      value={{
        isHistoryOpen,
        isLogOpen,
        setHistoryOpen,
        setLogOpen,
        openLogInteraction,
        closeLogInteraction,
        openHistory,
        closeHistory,
        logPrefillPhone,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within DrawerProvider');
  }
  return context;
}
