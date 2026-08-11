/**
 * @fileoverview Shared media preview thumbnail box used by the image-compression
 * and audio-extraction pages.
 *
 * Renders a compact preview row: an optional thumbnail image (square for
 * images, wide for videos) with a floating remove button, plus an info column
 * provided by the caller (file name, dimensions/size, stream details). The
 * thumbnail is omitted while `imageSrc` is null so a loading state can simply
 * leave the remove button and info text visible.
 *
 * Props (see {@link MediaPreviewProps}):
 *  - imageSrc: data URL of the thumbnail, or null while loading.
 *  - alt: alt text for the image (the source file name).
 *  - removeLabel: accessible label for the remove button.
 *  - testId / removeTestId: test ids for the box and the remove button.
 *  - variant: 'square' (images) or 'wide' (videos) thumbnail aspect.
 *  - onRemove: callback fired when the remove button is clicked.
 *  - children: info content rendered in the column beside the thumbnail.
 */

import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { MediaPreviewProps } from './types';
import { PreviewBox, PreviewImage, PreviewImageBox, PreviewInfo, PreviewCloseButton } from '../styles/MediaPreview.styles';

/**
 * Renders the shared media preview row.
 *
 * @param {MediaPreviewProps} props - Component props (see type docs above).
 * @returns {JSX.Element} The preview row.
 */
export default function MediaPreview({
  imageSrc,
  alt,
  removeLabel,
  testId,
  removeTestId,
  variant = 'square',
  onRemove,
  children,
}: MediaPreviewProps) {
  return (
    <PreviewBox data-testid={testId}>
      <PreviewImageBox>
        {imageSrc && <PreviewImage src={imageSrc} alt={alt} variant={variant} />}
        <PreviewCloseButton size="small" aria-label={removeLabel} data-testid={removeTestId} onClick={onRemove}>
          <FontAwesomeIcon icon={faXmark} />
        </PreviewCloseButton>
      </PreviewImageBox>
      <PreviewInfo>{children}</PreviewInfo>
    </PreviewBox>
  );
}
