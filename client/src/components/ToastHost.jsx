import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback((variant, message) => {
    setToasts((list) => [...list.slice(-2), { id: `${Date.now()}-${Math.random()}`, variant, message }]);
  }, []);

  const api = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('danger', message),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer position="bottom-end" className="toast-host p-3" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} onClose={() => dismiss(t.id)} show autohide delay={t.variant === 'danger' ? 8000 : 4500}
            className={`lp-toast lp-toast-${t.variant}`} role={t.variant === 'danger' ? 'alert' : 'status'}>
            <Toast.Body className="d-flex align-items-start gap-2">
              <span className="flex-grow-1">{t.message}</span>
              <button type="button" className="btn-close" aria-label="Dismiss message" onClick={() => dismiss(t.id)} />
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
