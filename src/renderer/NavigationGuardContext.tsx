/**
 * @fileoverview Route-navigation guard shared by pages that hold unsaved work.
 *
 * Pages register a predicate describing whether leaving the current route would
 * discard something the user cares about (for Copilot, an active conversation).
 * Internal navigation is routed through {@link useNavigationGuard}'s `navigate`,
 * which parks the requested destination and asks for confirmation instead of
 * navigating immediately when the predicate returns true. Confirming resumes the
 * parked navigation through the raw router navigate; canceling keeps the user
 * where they are.
 *
 * The guard is intentionally app-wide rather than router-specific: the renderer
 * uses a plain `HashRouter`, whose `useBlocker` is unavailable. Centralizing the
 * check here also means drawer links, keyboard shortcuts, and in-page links are
 * all covered by the same confirmation.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, type NavigateOptions, type To } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from './components/ConfirmDialog';

/** Returns true when leaving the current route should ask for confirmation. */
export type NavigationGuard = () => boolean;

/** A navigate function that consults the registered guard before routing. */
type GuardedNavigate = (to: To, options?: NavigateOptions) => void;

/**
 * Navigation helpers exposed to pages and chrome components.
 * @interface NavigationGuardApi
 * @property {GuardedNavigate} navigate - Navigates unless the active guard
 *   blocks the transition and opens the confirmation dialog.
 * @property {GuardedNavigate} navigateWithoutGuard - Navigates immediately,
 *   bypassing the guard. Used for app-initiated transitions such as the
 *   post-enqueue jump to the batch queue.
 * @property {(guard: NavigationGuard) => () => void} registerGuard - Registers
 *   the active route's guard and returns a cleanup that removes it. Registering
 *   a newer guard replaces the previous one.
 */
export interface NavigationGuardApi {
  navigate: GuardedNavigate;
  navigateWithoutGuard: GuardedNavigate;
  registerGuard: (guard: NavigationGuard) => () => void;
}

const NavigationGuardContext = createContext<NavigationGuardApi | null>(null);

/**
 * Returns the navigation guard API.
 *
 * When no provider is mounted (isolated page tests, storybook-style renders),
 * the returned functions fall back to the router's raw navigate and the guard
 * registration is a no-op. The production tree always mounts
 * {@link NavigationGuardProvider}, so real navigation is guarded.
 *
 * @returns {NavigationGuardApi} The guarded navigation helpers.
 */
export function useNavigationGuard(): NavigationGuardApi {
  const navigate = useNavigate();
  const context = useContext(NavigationGuardContext);
  return useMemo(
    () =>
      context ?? {
        navigate,
        navigateWithoutGuard: navigate,
        registerGuard: () => () => undefined,
      },
    [context, navigate],
  );
}

/**
 * Mounts the navigation-guard context and its confirmation dialog.
 * @param {{ children: ReactNode }} props - The app subtree to guard.
 * @param {ReactNode} props.children - The routed application.
 * @returns {JSX.Element} The provider and global leave-confirmation dialog.
 */
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [pending, setPending] = useState<{ to: To; options?: NavigateOptions } | null>(null);
  const guardRef = useRef<NavigationGuard | null>(null);

  const registerGuard = useCallback((guard: NavigationGuard) => {
    guardRef.current = guard;
    return () => {
      if (guardRef.current === guard) guardRef.current = null;
    };
  }, []);

  const guardedNavigate = useCallback<GuardedNavigate>(
    (to, options) => {
      const samePath = typeof to === 'string' && to === location.pathname;
      if (!samePath && guardRef.current?.()) {
        setPending({ to, options });
        return;
      }
      navigate(to, options);
    },
    [navigate, location.pathname],
  );

  const navigateWithoutGuard = useCallback<GuardedNavigate>((to, options) => navigate(to, options), [navigate]);

  const handleConfirm = () => {
    const next = pending;
    setPending(null);
    if (next) navigate(next.to, next.options);
  };

  const handleCancel = () => setPending(null);

  const value = useMemo<NavigationGuardApi>(
    () => ({ navigate: guardedNavigate, navigateWithoutGuard, registerGuard }),
    [guardedNavigate, navigateWithoutGuard, registerGuard],
  );

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        title={t('leaveConfirm.title')}
        message={t('leaveConfirm.message')}
        confirmLabel={t('leaveConfirm.confirmLabel')}
        cancelLabel={t('leaveConfirm.cancelLabel')}
        onClose={handleCancel}
        onConfirm={handleConfirm}
      />
    </NavigationGuardContext.Provider>
  );
}
