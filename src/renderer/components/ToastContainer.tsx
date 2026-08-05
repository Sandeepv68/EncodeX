import { useState, useEffect, useRef } from 'react';
import { Snackbar } from '@mui/material';
import { useToastStore } from '../stores/toastStore';
import type { Toast } from '../stores/toastStore';
import { ToastAlert, ToastMessage, ToastDetail } from '../styles/ToastContainer.styles';
import { TOAST_DEFAULT_DURATION_MS } from '../../shared/constants';

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  const [active, setActive] = useState<Toast | null>(null);
  const queueRef = useRef<Toast[]>([]);
  const openRef = useRef(false);

  useEffect(() => {
    queueRef.current = toasts;
    if (!openRef.current && toasts.length > 0) {
      openRef.current = true;
      setActive(toasts[0]);
    }
  }, [toasts]);

  const handleClose = () => {
    openRef.current = false;
    const current = active;
    setActive(null);
    if (current) {
      removeToast(current.id);
    }
  };

  const handleExited = () => {
    const remaining = queueRef.current.filter((t) => t.id !== active?.id);
    if (remaining.length > 0) {
      openRef.current = true;
      setActive(remaining[0]);
    }
  };

  if (!active) return null;

  return (
    <Snackbar
      key={active.id}
      open
      autoHideDuration={active.duration ?? TOAST_DEFAULT_DURATION_MS}
      onClose={handleClose}
      TransitionProps={{ onExited: handleExited }}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <ToastAlert onClose={handleClose} severity={active.type} variant="filled">
        <ToastMessage>{active.message}</ToastMessage>
        {active.detail && <ToastDetail>{active.detail}</ToastDetail>}
      </ToastAlert>
    </Snackbar>
  );
}
