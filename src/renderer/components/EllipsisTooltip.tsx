import { cloneElement, useRef, useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import type { EllipsisTooltipProps } from './types';

export default function EllipsisTooltip({ title, children }: EllipsisTooltipProps) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  const handleEnter = () => {
    const el = ref.current;
    if (el && el.scrollWidth > el.clientWidth + 1) {
      setOpen(true);
    }
  };

  const child = cloneElement(children, { ref });

  return (
    <Box onMouseEnter={handleEnter} onMouseLeave={() => setOpen(false)} sx={{ minWidth: 0 }}>
      <Tooltip title={title} placement="top" arrow open={open} onClose={() => setOpen(false)}>
        {child}
      </Tooltip>
    </Box>
  );
}
