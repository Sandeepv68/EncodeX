import { Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { InfoIconWrapper, InfoIcon } from '../styles/InfoTooltip.styles';

interface Props {
  title: string;
}

export default function InfoTooltip({ title }: Props) {
  return (
    <Tooltip title={title}>
      <InfoIconWrapper data-testid="info-tooltip">
        <InfoIcon icon={faCircleInfo} />
      </InfoIconWrapper>
    </Tooltip>
  );
}
