import { Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import type { InfoTooltipProps } from './types';
import { InfoIconWrapper, InfoIcon } from '../styles/InfoTooltip.styles';

export default function InfoTooltip({ title }: InfoTooltipProps) {
  return (
    <Tooltip title={title}>
      <InfoIconWrapper data-testid="info-tooltip">
        <InfoIcon icon={faCircleInfo} />
      </InfoIconWrapper>
    </Tooltip>
  );
}
