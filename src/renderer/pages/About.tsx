/**
 * @fileoverview About page. Introduces the application, its capabilities, and
 * its author. Corresponds to the `/about` route and is reached from the
 * navigation bar.
 *
 * Renders a PageContainer with the app logo, an intro subtitle, a feature list
 * reusing the dashboard card descriptions, meta rows for the installed version
 * (read from package.json) and the technologies the app is built with, and an
 * author & feedback section with links to the author's GitHub profile and the
 * project repository. External links open in the system browser via the main
 * process `setWindowOpenHandler`.
 *
 * No IPC calls are made from this page; everything shown is static metadata.
 */

import { useTranslation } from 'react-i18next';
import { Divider, Link, Typography, Button } from '@mui/material';
import { faArrowUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PageContainer from '../components/PageContainer';
import { pageIcons } from '../pageIcons';
import pkg from '../../../package.json';
import appLogo from '../../../assets/banner.png';
import { AboutLogo, AboutFeatureList, AboutFeatureItem, AboutMetaRow, AboutMetaLabel } from '../styles/About.styles';
import { useUpdateStore } from '../stores/updateStore';

/**
 * Translation keys of the feature bullets, reused from the dashboard card
 * descriptions so the About page and the dashboard never drift apart.
 * @const {readonly string[]} FEATURE_DESC_KEYS
 */
const FEATURE_DESC_KEYS: readonly string[] = [
  'dashboard.descConvert',
  'dashboard.descMediaInfo',
  'dashboard.descImage',
  'dashboard.descAudio',
  'dashboard.descCut',
  'dashboard.descBatch',
];

/**
 * Author name shown in the author meta row. @const {string} AUTHOR_NAME
 */
const AUTHOR_NAME = 'Sandeep Vattapparambil';

/**
 * Author's GitHub profile URL. @const {string} AUTHOR_GITHUB_URL
 */
const AUTHOR_GITHUB_URL = 'https://github.com/Sandeepv68';

/**
 * Project repository URL. @const {string} REPOSITORY_URL
 */
const REPOSITORY_URL = 'https://github.com/Sandeepv68/EncodeX';

/**
 * Project issue tracker URL, used as the feedback target.
 * @const {string} ISSUES_URL
 */
const ISSUES_URL = `${REPOSITORY_URL}/issues`;

/**
 * URL of the LICENSE file in the repository, linked from the license row.
 * @const {string} LICENSE_URL
 */
const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;

/**
 * Renders the About page (`/about`).
 *
 * Lays out the app logo, the intro, a detailed product description, a "what
 * you can do" bullet list, version and tech-stack meta rows, an author &
 * feedback section linking to the author's GitHub profile, the repository, and
 * the issue tracker, and a license section summarizing the MIT license, all
 * inside the standard PageContainer card, followed by a short acknowledgement
 * line crediting FFmpeg and the open-source community.
 *
 * @returns {JSX.Element} The page content.
 */
export default function About() {
  const { t } = useTranslation();
  const { openDialog, checkForUpdates } = useUpdateStore();

  const handleCheckForUpdates = () => {
    openDialog();
    checkForUpdates();
  };

  return (
    <PageContainer title={t('about.title')} icon={pageIcons['/about']}>
      <AboutLogo src={appLogo} alt={t('about.logoAlt')} />
      <Typography variant="body1" color="text.secondary">
        {t('about.subtitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('about.description')}
      </Typography>
      <Divider />
      <Typography variant="h6" component="h2">
        {t('about.featuresTitle')}
      </Typography>
      <AboutFeatureList>
        {FEATURE_DESC_KEYS.map((key) => (
          <AboutFeatureItem key={key}>{t(key)}</AboutFeatureItem>
        ))}
      </AboutFeatureList>
      <Divider />
      <AboutMetaRow>
        <AboutMetaLabel variant="body2">{t('about.version')}</AboutMetaLabel>
        <Typography variant="body2">{pkg.version}</Typography>
      </AboutMetaRow>
      <AboutMetaRow>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FontAwesomeIcon icon={faArrowUp} />}
          onClick={handleCheckForUpdates}
        >
          {t('about.checkForUpdates')}
        </Button>
      </AboutMetaRow>
      <AboutMetaRow>
        <AboutMetaLabel variant="body2">{t('about.builtWith')}</AboutMetaLabel>
        <Typography variant="body2">FFmpeg, React, TypeScript, Electron</Typography>
      </AboutMetaRow>
      <Divider />
      <Typography variant="h6" component="h2">
        {t('about.authorTitle')}
      </Typography>
      <AboutMetaRow>
        <AboutMetaLabel variant="body2">{t('about.author')}</AboutMetaLabel>
        <Link variant="body2" href={AUTHOR_GITHUB_URL} target="_blank" rel="noopener noreferrer">
          {AUTHOR_NAME}
        </Link>
      </AboutMetaRow>
      <AboutMetaRow>
        <AboutMetaLabel variant="body2">{t('about.repository')}</AboutMetaLabel>
        <Link variant="body2" href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
          github.com/Sandeepv68/EncodeX
        </Link>
      </AboutMetaRow>
      <Typography variant="body2" color="text.secondary">
        {t('about.feedback')}{' '}
        <Link href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
          {t('about.reportIssue')}
        </Link>
      </Typography>
      <Divider />
      <Typography variant="h6" component="h2">
        {t('about.licenseTitle')}
      </Typography>
      <Link variant="body2" href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
        {t('about.licenseName')}
      </Link>
      <Typography variant="caption" color="text.secondary">
        {t('about.copyright')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('about.licenseSummary')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('about.acknowledgements')}
      </Typography>
    </PageContainer>
  );
}
