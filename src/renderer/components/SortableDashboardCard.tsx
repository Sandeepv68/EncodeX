import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { pageIcons } from '../pageIcons';
import { cardRings } from '../utils/dashboard-rings';
import {
  CardBackgroundSvg,
  CardBody,
  CardDescription,
  CardLink,
  CardTitleText,
  FeatureCard,
  FeatureIconBox,
} from '../styles/Dashboard.styles';
import { CardEditControls, CardGroupButton, DragHandle, SortableGridItem } from '../styles/DashboardEditing.styles';
import type { SortableDashboardCardProps } from './types';

/** A dashboard feature card wrapped in a dnd-kit sortable, shown only in edit mode. */
export default function SortableDashboardCard({ card, index, onGroupMenu }: SortableDashboardCardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } = useSortable({ id: card.to });
  const title = t(`nav.${card.titleKey}`);

  return (
    <SortableGridItem
      ref={setNodeRef}
      size={{ xs: 12, sm: 6, md: 4 }}
      data-testid={`sortable-card-${card.to}`}
      $transform={CSS.Transform.toString(transform)}
      $transition={transition}
      $dragging={isDragging}
      $sorting={isSorting}
    >
      <FeatureCard gradientAngle={index * 60} $animationDelay="0s">
        <CardBackgroundSvg aria-hidden="true" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
          {cardRings(card.to).map((ring) => (
            <g key={ring.id} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke">
              {ring.radii.map((radius) => (
                <circle key={radius} cx={ring.cx} cy={ring.cy} r={radius} />
              ))}
            </g>
          ))}
        </CardBackgroundSvg>
        <CardLink disabled>
          <FeatureIconBox>{pageIcons[card.to]}</FeatureIconBox>
          <CardBody>
            <CardTitleText variant="h6" component="h2">
              {title}
            </CardTitleText>
            <CardDescription variant="body2" color="text.secondary">
              {t(`dashboard.${card.descriptionKey}`)}
            </CardDescription>
          </CardBody>
        </CardLink>
        <CardEditControls>
          <CardGroupButton
            size="small"
            aria-label={t('dashboard.edit.group')}
            data-testid={`dashboard-group-button-${card.to}`}
            onClick={(event) => onGroupMenu(event, card.to)}
          >
            <FontAwesomeIcon icon={faLayerGroup} />
          </CardGroupButton>
          <DragHandle
            size="small"
            aria-label={t('dashboard.edit.dragHandle', { title })}
            data-testid={`dashboard-drag-handle-${card.to}`}
            {...attributes}
            {...listeners}
          >
            <FontAwesomeIcon icon={faGripVertical} />
          </DragHandle>
        </CardEditControls>
      </FeatureCard>
    </SortableGridItem>
  );
}
