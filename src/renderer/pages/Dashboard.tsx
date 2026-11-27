/**
 * @fileoverview Dashboard page. The landing/home screen that greets the user and
 * links to every tool in the app. Corresponds to the `/` route.
 *
 * Renders a welcome heading, the icon-only Dashboard/Quick Links actions row,
 * the getting-started banner and either a responsive grid of feature cards or
 * the Quick Links panel. Clicking a card navigates to its route; in edit
 * mode the same cards become sortable (dnd-kit) and can be assigned to the
 * built-in Favourites group or to custom groups stored by `dashboardLayoutStore`.
 *
 * Side effects: logs `LOG_DASHBOARD_RENDERED` once on mount and records
 * analytics for view/edit/group/reorder interactions. No IPC calls are made.
 */

import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Menu, MenuItem, TextField } from '@mui/material';
import { Logger } from '../../shared/logger';
import { pageIcons } from '../pageIcons';
import { resolveDashboardAppIcon } from '../utils/easter-egg-assets';
import { cardRings } from '../utils/dashboard-rings';
import { useHotkeys } from '../hooks/useHotkeys';
import { SHORTCUTS, SHORTCUT_BY_ID, formatShortcut } from '../constants/shortcuts';
import { useFeatureFlag } from '../hooks/useFeatureFlags';
import { DASHBOARD_CARD_DESCRIPTIONS, DASHBOARD_CARD_TITLES, FAVOURITES_GROUP_ID } from '../constants/dashboard';
import { groupKind } from '../utils/dashboard-layout';
import { useDashboardLayoutStore } from '../stores/dashboardLayoutStore';
import type { DashboardGroupId } from '../stores/types';
import type { DashboardView } from '../components/types';
import type { DashboardCardSpec } from './types';

import {
  WelcomeTitle,
  WelcomeIcon,
  DashboardSubtitle,
  FeatureCard,
  CardLink,
  FeatureIconBox,
  CardTitleText,
  CardBody,
  DashboardRoot,
  FeatureGrid,
  FeatureGridItem,
  CardDescription,
  CardBackgroundSvg,
  DashboardFooter,
} from '../styles/Dashboard.styles';
import { GroupCardsGrid, GroupHeaderRow, GroupNameLabel, GroupSection, GroupTitle } from '../styles/DashboardEditing.styles';
import { LOG_DASHBOARD_RENDERED } from '../../shared/log-constants';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import GettingStartedCard from '../components/GettingStartedCard';
import DashboardActionsRow from '../components/DashboardActionsRow';
import DashboardGroupBar, { DashboardGroupIcon } from '../components/DashboardGroupBar';
import QuickLinksPanel from '../components/QuickLinksPanel';
import SortableDashboardCard from '../components/SortableDashboardCard';

/** Logger instance scoped to this page. */
const log = new Logger('renderer/pages/Dashboard');

/** Renders the Dashboard page (`/`). */
export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const automationsEnabled = useFeatureFlag('automations_page', import.meta.env.DEV);
  const appIcon = resolveDashboardAppIcon(new Date());

  const order = useDashboardLayoutStore((s) => s.order);
  const assignments = useDashboardLayoutStore((s) => s.assignments);
  const customGroups = useDashboardLayoutStore((s) => s.customGroups);
  const reorder = useDashboardLayoutStore((s) => s.reorder);
  const assignGroup = useDashboardLayoutStore((s) => s.assignGroup);
  const createGroup = useDashboardLayoutStore((s) => s.createGroup);
  const renameGroup = useDashboardLayoutStore((s) => s.renameGroup);
  const deleteGroup = useDashboardLayoutStore((s) => s.deleteGroup);
  const resetLayout = useDashboardLayoutStore((s) => s.resetLayout);

  const [view, setView] = useState<DashboardView>('dashboard');
  const [editing, setEditing] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string | null>(null);
  const [cardMenu, setCardMenu] = useState<{ route: string; anchor: HTMLElement } | null>(null);
  const [groupMenu, setGroupMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [groupDialog, setGroupDialog] = useState<{ id?: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  useEffect(() => {
    log.debug(LOG_DASHBOARD_RENDERED);
  }, []);

  const cards = useMemo<DashboardCardSpec[]>(
    () =>
      order.map((route) => ({
        to: route,
        titleKey: DASHBOARD_CARD_TITLES[route] ?? 'batchQueue',
        descriptionKey: DASHBOARD_CARD_DESCRIPTIONS[route] ?? 'descBatch',
        groupId: assignments[route] ?? null,
      })),
    [order, assignments],
  );

  const visibleCards = useMemo(() => cards.filter((card) => automationsEnabled || card.to !== '/automations'), [cards, automationsEnabled]);

  const sections = useMemo(() => {
    const groupIds: Array<DashboardGroupId | null> = [FAVOURITES_GROUP_ID, ...customGroups.map((group) => group.id), null];
    return groupIds
      .map((id) => ({
        id,
        name:
          id === null
            ? t('dashboard.groups.ungrouped')
            : id === FAVOURITES_GROUP_ID
              ? t('dashboard.groups.favourites')
              : (customGroups.find((group) => group.id === id)?.name ?? ''),
        cards: visibleCards.filter((card) => card.groupId === id),
      }))
      .filter((section) => section.cards.length > 0);
  }, [visibleCards, customGroups, t]);

  const hasSavedGroups = visibleCards.some((card) => card.groupId !== null);

  const barGroups = useMemo(
    () => [
      {
        id: FAVOURITES_GROUP_ID,
        name: t('dashboard.groups.favourites'),
        count: visibleCards.filter((card) => card.groupId === FAVOURITES_GROUP_ID).length,
      },
      ...customGroups.map((group) => ({
        id: group.id,
        name: group.name,
        count: visibleCards.filter((card) => card.groupId === group.id).length,
      })),
    ],
    [visibleCards, customGroups, t],
  );

  useHotkeys(
    editing || view !== 'dashboard'
      ? []
      : SHORTCUTS.filter((spec) => spec.section === 'dashboard' && spec.to).map((spec) => ({
          id: spec.id,
          handler: () => {
            recordAnalyticsEvent(createAnalyticsEvent('dashboard_shortcut_used', { shortcutId: spec.id }));
            navigate(spec.to!);
          },
        })),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleToggleView(): void {
    const next: DashboardView = view === 'dashboard' ? 'quick-links' : 'dashboard';
    recordAnalyticsEvent(createAnalyticsEvent('dashboard_view_changed', { route: next }));
    setView(next);
    if (next === 'quick-links') setEditing(false);
  }

  function handleToggleEdit(): void {
    const next = !editing;
    setEditing(next);
    recordAnalyticsEvent(createAnalyticsEvent('dashboard_edit_toggled', { enabled: next }));
  }

  function handleDragStart(event: DragStartEvent): void {
    setActiveRoute(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveRoute(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const route = String(active.id);
    reorder(route, String(over.id));
    recordAnalyticsEvent(createAnalyticsEvent('dashboard_card_reordered', { route, groupKind: groupKind(assignments[route] ?? null) }));
  }

  function handleCardGroupMenu(event: MouseEvent<HTMLElement>, route: string): void {
    setCardMenu({ route, anchor: event.currentTarget });
  }

  function handleBarGroupMenu(event: MouseEvent<HTMLElement>, id: string): void {
    setGroupMenu({ id, anchor: event.currentTarget });
  }

  function handleAssign(groupId: DashboardGroupId | null): void {
    if (!cardMenu) return;
    assignGroup(cardMenu.route, groupId);
    recordAnalyticsEvent(createAnalyticsEvent('dashboard_group_assigned', { groupKind: groupKind(groupId) }));
    setCardMenu(null);
  }

  function handleNewGroup(route: string | null): void {
    setPendingRoute(route);
    setGroupMenu(null);
    setCardMenu(null);
    setDraftName('');
    setGroupDialog({});
  }

  function handleSaveGroup(): void {
    const name = draftName.trim();
    if (!name || !groupDialog) return;
    if (groupDialog.id) {
      renameGroup(groupDialog.id, name);
    } else {
      const id = createGroup(name);
      if (id) {
        recordAnalyticsEvent(createAnalyticsEvent('dashboard_group_created', { groupCount: customGroups.length + 1 }));
        if (pendingRoute) {
          assignGroup(pendingRoute, id);
          recordAnalyticsEvent(createAnalyticsEvent('dashboard_group_assigned', { groupKind: 'custom' }));
        }
      }
    }
    setGroupDialog(null);
    setPendingRoute(null);
    setDraftName('');
  }

  function handleDeleteGroup(): void {
    if (!deleteId) return;
    deleteGroup(deleteId);
    recordAnalyticsEvent(createAnalyticsEvent('dashboard_group_deleted', { groupCount: Math.max(0, customGroups.length - 1) }));
    setDeleteId(null);
  }

  function renderCard(card: DashboardCardSpec, index: number, overlay = false): ReactNode {
    return (
      <FeatureCard gradientAngle={index * 60} $animationDelay={`${0.3 + index * 0.08}s`} $static={overlay} $dragOverlay={overlay}>
        <CardBackgroundSvg aria-hidden="true" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
          {cardRings(card.to).map((ring) => (
            <g key={ring.id} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke">
              {ring.radii.map((radius) => (
                <circle key={radius} cx={ring.cx} cy={ring.cy} r={radius} />
              ))}
            </g>
          ))}
        </CardBackgroundSvg>
        <CardLink
          onClick={() => {
            recordAnalyticsEvent(createAnalyticsEvent('dashboard_card_clicked', { route: card.to }));
            navigate(card.to);
          }}
        >
          <FeatureIconBox>{pageIcons[card.to]}</FeatureIconBox>
          <CardBody>
            <CardTitleText variant="h6" component="h2">
              {t(`nav.${card.titleKey}`)}
            </CardTitleText>
            <CardDescription variant="body2" color="text.secondary">
              {t(`dashboard.${card.descriptionKey}`)}
            </CardDescription>
          </CardBody>
        </CardLink>
      </FeatureCard>
    );
  }

  function renderSection(section: (typeof sections)[number], editable: boolean): ReactNode {
    const SectionGrid = section.id === null ? FeatureGrid : GroupCardsGrid;
    return (
      <GroupSection key={section.id ?? 'ungrouped'} data-testid={`dashboard-section-${section.id ?? 'ungrouped'}`}>
        {section.id !== null && (
          <GroupHeaderRow>
            <DashboardGroupIcon groupId={section.id} />
            <GroupTitle variant="subtitle2">{section.name}</GroupTitle>
          </GroupHeaderRow>
        )}
        <SectionGrid container spacing={2}>
          {section.cards.map((card) => {
            const index = visibleCards.findIndex((candidate) => candidate.to === card.to);
            return editable ? (
              <SortableDashboardCard key={card.to} card={card} index={index} onGroupMenu={handleCardGroupMenu} />
            ) : (
              <FeatureGridItem size={{ xs: 12, sm: 6, md: 4 }} key={card.to}>
                {renderCard(card, index)}
              </FeatureGridItem>
            );
          })}
        </SectionGrid>
      </GroupSection>
    );
  }

  const overlayCard = activeRoute ? visibleCards.find((card) => card.to === activeRoute) : undefined;

  return (
    <DashboardRoot>
      <WelcomeTitle variant="h4" component="h1">
        <WelcomeIcon src={appIcon} alt="" draggable={false} />
        {t('dashboard.welcome')} 👋
      </WelcomeTitle>
      <DashboardSubtitle color="text.secondary">{t('dashboard.subtitle')}</DashboardSubtitle>
      <DashboardActionsRow view={view} editing={editing} onToggleView={handleToggleView} onToggleEdit={handleToggleEdit} />
      <GettingStartedCard />
      {view === 'quick-links' ? (
        <QuickLinksPanel />
      ) : (
        <>
          {editing && (
            <DashboardGroupBar
              groups={barGroups}
              onGroupMenu={handleBarGroupMenu}
              onNewGroup={() => handleNewGroup(null)}
              onReset={() => {
                resetLayout();
                setGroupDialog(null);
              }}
            />
          )}
          {editing ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveRoute(null)}
            >
              <SortableContext items={visibleCards.map((card) => card.to)} strategy={rectSortingStrategy}>
                {sections.map((section) => renderSection(section, true))}
              </SortableContext>
              <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
                {overlayCard ? renderCard(overlayCard, 0, true) : null}
              </DragOverlay>
            </DndContext>
          ) : hasSavedGroups ? (
            sections.map((section) => renderSection(section, false))
          ) : (
            <FeatureGrid container spacing={2}>
              {visibleCards.map((card, index) => (
                <FeatureGridItem size={{ xs: 12, sm: 6, md: 4 }} key={card.to}>
                  {renderCard(card, index)}
                </FeatureGridItem>
              ))}
            </FeatureGrid>
          )}
        </>
      )}

      {cardMenu && (
        <Menu anchorEl={cardMenu.anchor} open onClose={() => setCardMenu(null)} data-testid="dashboard-card-group-menu">
          <MenuItem onClick={() => handleAssign(FAVOURITES_GROUP_ID)} data-testid="dashboard-assign-favourites">
            {t('dashboard.groups.favourites')}
          </MenuItem>
          <MenuItem onClick={() => handleAssign(null)} data-testid="dashboard-assign-ungrouped">
            {t('dashboard.groups.ungrouped')}
          </MenuItem>
          {customGroups.map((group) => (
            <MenuItem key={group.id} onClick={() => handleAssign(group.id)} data-testid={`dashboard-assign-${group.id}`}>
              {group.name}
            </MenuItem>
          ))}
          <MenuItem onClick={() => handleNewGroup(cardMenu.route)} data-testid="dashboard-assign-new-group">
            {t('dashboard.edit.newGroup')}
          </MenuItem>
        </Menu>
      )}

      {groupMenu && (
        <Menu anchorEl={groupMenu.anchor} open onClose={() => setGroupMenu(null)}>
          <MenuItem
            onClick={() => {
              const group = customGroups.find((candidate) => candidate.id === groupMenu.id);
              setDraftName(group?.name ?? '');
              setGroupDialog({ id: groupMenu.id });
              setGroupMenu(null);
            }}
            data-testid="dashboard-rename-group"
          >
            {t('dashboard.edit.rename')}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setDeleteId(groupMenu.id);
              setGroupMenu(null);
            }}
            data-testid="dashboard-delete-group"
          >
            {t('dashboard.edit.delete')}
          </MenuItem>
        </Menu>
      )}

      {groupDialog && (
        <Dialog open onClose={() => setGroupDialog(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{t(groupDialog.id ? 'dashboard.edit.renameGroupTitle' : 'dashboard.edit.newGroupTitle')}</DialogTitle>
          <DialogContent>
            <GroupNameLabel htmlFor="dashboard-group-name" data-testid="dashboard-group-name-label">
              {t('dashboard.edit.groupName')}
            </GroupNameLabel>
            <TextField
              id="dashboard-group-name"
              fullWidth
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSaveGroup();
              }}
              slotProps={{ htmlInput: { 'data-testid': 'dashboard-group-name-input' } }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGroupDialog(null)}>{t('dashboard.edit.cancel')}</Button>
            <Button onClick={handleSaveGroup} variant="contained" data-testid="dashboard-save-group">
              {groupDialog.id ? t('dashboard.edit.rename') : t('dashboard.edit.create')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {deleteId && (
        <Dialog open onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('dashboard.edit.deleteGroupTitle')}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t('dashboard.edit.deleteGroupMessage')}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteId(null)}>{t('dashboard.edit.cancel')}</Button>
            <Button onClick={handleDeleteGroup} color="error" data-testid="dashboard-confirm-delete-group">
              {t('dashboard.edit.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <DashboardFooter variant="caption" color="text.secondary" data-testid="dashboard-shortcuts-hint">
        {t('dashboard.shortcutsFooter', { shortcut: formatShortcut(SHORTCUT_BY_ID['global.help'].keys) })}
      </DashboardFooter>
    </DashboardRoot>
  );
}
