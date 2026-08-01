import { Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';

interface Props {
  title: string;
}

export default function InfoTooltip({ title }: Props) {
  return (
    <Tooltip title={title}>
      <span data-testid="info-tooltip" style={{ display: 'inline-flex', cursor: 'help', marginLeft: 4, verticalAlign: 'middle' }}>
        <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: 14 }} />
      </span>
    </Tooltip>
  );
}
