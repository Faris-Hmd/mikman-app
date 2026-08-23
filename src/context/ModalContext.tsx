import { createContext, useContext } from 'react';

export interface ModalContextType {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'warning') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);

export { ModalProvider } from './ModalProvider';

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}