import type { ReactNode } from 'react';
import { Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { QUEUE_STATUS } from '../../shared/media-options';
import type { BoneProps } from './types';
import { ContentPaper, PageBody, PageRoot, TitleIcon } from '../styles/PageContainer.styles';
import { SectionCard } from '../styles/form.styles';
import { SectionsStack } from '../styles/VideoCut.styles';
import { ControlsPaper, ToolbarRow } from '../styles/BatchControls.styles';
import { EncodingPaper } from '../styles/BatchEncodingPanel.styles';
import { CardBody, CardContent, CardHeaderRow, JobCard, ThumbWrap } from '../styles/QueueJobCard.styles';
import { LogsBody, LogsHeader, LogsRoot } from '../styles/Logs.styles';
import { ModeSettingsSection, SettingsHeader, SettingsRoot, SettingsSection, SettingsTitle } from '../styles/Settings.styles';
import { ThemeSettingsSection } from '../styles/settings/ThemeSettingsSection.styles';
import { InfoPaper } from '../styles/MediaInfo.styles';
import {
  LoadingRegion,
  SkeletonButton,
  SkeletonChatArea,
  SkeletonChipRow,
  SkeletonComposer,
  SkeletonComposerShell,
  SkeletonCopilotLayout,
  SkeletonDivider,
  SkeletonDropZone,
  SkeletonField,
  SkeletonFieldGrid,
  SkeletonFilePathRow,
  SkeletonIconButton,
  SkeletonIconButtonSmall,
  SkeletonInput,
  SkeletonLogRow,
  SkeletonLogo,
  SkeletonMetaRow,
  SkeletonPageHeaderRow,
  SkeletonPageIcon,
  SkeletonPageTitle,
  SkeletonPlayer,
  SkeletonProgress,
  SkeletonPushEnd,
  SkeletonRow,
  SkeletonSearchField,
  SkeletonSettingsLabelBlock,
  SkeletonStack,
  SkeletonSwitch,
  SkeletonTable,
  SkeletonTableRow,
  SkeletonThemeCard,
  SkeletonThumb,
  SkeletonTimeline,
  SkeletonToggleRow,
} from '../styles/PageSkeletons.styles';

function Bone(props: BoneProps) {
  return <Skeleton variant="rounded" {...props} />;
}

function SkeletonStatus({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <LoadingRegion role="status" aria-busy="true" aria-label={t('app.loading')}>
      {children}
    </LoadingRegion>
  );
}

function PageHeaderSkeleton() {
  return (
    <SkeletonPageHeaderRow>
      <TitleIcon>
        <SkeletonPageIcon variant="rounded" />
      </TitleIcon>
      <SkeletonPageTitle variant="rounded" />
    </SkeletonPageHeaderRow>
  );
}

function PageSkeletonFrame({ children, paper = true }: { children: ReactNode; paper?: boolean }) {
  return (
    <SkeletonStatus>
      <PageRoot $hasAside={false}>
        <PageBody>{paper ? <ContentPaper>{children}</ContentPaper> : children}</PageBody>
      </PageRoot>
    </SkeletonStatus>
  );
}

function FieldSkeleton({ labelWidth = '32%', inputHeight = 40 }: { labelWidth?: string | number; inputHeight?: number }) {
  return (
    <SkeletonField>
      <Bone width={labelWidth} height={12} />
      <SkeletonInput height={inputHeight} />
    </SkeletonField>
  );
}

function FilePathSkeleton() {
  return (
    <SkeletonField>
      <Bone width="22%" height={12} />
      <SkeletonFilePathRow>
        <SkeletonInput />
        <SkeletonButton />
      </SkeletonFilePathRow>
    </SkeletonField>
  );
}

function TableSkeleton({ rows = 4, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <SkeletonTable>
      <SkeletonTableRow>
        {Array.from({ length: columns }, (_, index) => (
          <Bone key={`table-head-${index}`} height={12} />
        ))}
      </SkeletonTableRow>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <SkeletonTableRow key={`table-row-${rowIndex}`}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Bone key={`table-cell-${rowIndex}-${columnIndex}`} height={10} />
          ))}
        </SkeletonTableRow>
      ))}
    </SkeletonTable>
  );
}

function JobCardSkeleton() {
  return (
    <JobCard $status={QUEUE_STATUS.QUEUED}>
      <CardBody>
        <ThumbWrap>
          <SkeletonThumb variant="rectangular" />
        </ThumbWrap>
        <CardContent>
          <CardHeaderRow>
            <Bone width="46%" height={18} />
            <Bone width={72} height={24} />
          </CardHeaderRow>
          <SkeletonStack>
            <Bone width="68%" height={12} />
            <SkeletonProgress />
            <SkeletonMetaRow>
              <Bone width={96} height={10} />
              <Bone width={72} height={10} />
              <SkeletonPushEnd>
                <Bone width={64} height={10} />
              </SkeletonPushEnd>
            </SkeletonMetaRow>
          </SkeletonStack>
        </CardContent>
      </CardBody>
    </JobCard>
  );
}

function SettingsToggleSkeleton() {
  return (
    <SettingsSection>
      <SkeletonToggleRow>
        <SkeletonSwitch />
        <SkeletonSettingsLabelBlock>
          <Bone width={148} height={14} />
          <Bone width={240} height={12} />
        </SkeletonSettingsLabelBlock>
      </SkeletonToggleRow>
    </SettingsSection>
  );
}

export function ConvertSkeleton() {
  return (
    <PageSkeletonFrame>
      <SkeletonField>
        <Bone width="20%" height={12} />
        <SkeletonDropZone variant="rounded" />
      </SkeletonField>
      <FilePathSkeleton />
      <SkeletonDivider />
      <SkeletonStack>
        <Bone width={130} height={22} />
        <FieldSkeleton labelWidth="28%" />
        <SkeletonToggleRow>
          <SkeletonSwitch />
          <Bone width={140} height={12} />
        </SkeletonToggleRow>
        <SkeletonRow>
          <FieldSkeleton />
          <FieldSkeleton />
        </SkeletonRow>
        <SkeletonRow>
          <FieldSkeleton />
          <FieldSkeleton />
        </SkeletonRow>
        <FieldSkeleton labelWidth="34%" />
      </SkeletonStack>
      <SkeletonDivider />
      <SkeletonStack>
        <Bone width={150} height={22} />
        <SkeletonRow>
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </SkeletonRow>
        <SkeletonToggleRow>
          <SkeletonSwitch />
          <Bone width={160} height={12} />
        </SkeletonToggleRow>
      </SkeletonStack>
      <SkeletonChipRow>
        <SkeletonButton />
      </SkeletonChipRow>
    </PageSkeletonFrame>
  );
}

export function RemuxSkeleton() {
  return (
    <PageSkeletonFrame>
      <SkeletonField>
        <Bone width="18%" height={12} />
        <SkeletonDropZone variant="rounded" />
      </SkeletonField>
      <FieldSkeleton labelWidth="20%" />
      <SkeletonStack>
        <Bone width={120} height={20} />
        <SkeletonChipRow>
          <SkeletonButton />
          <SkeletonButton />
          <SkeletonButton />
        </SkeletonChipRow>
        <TableSkeleton rows={5} columns={6} />
      </SkeletonStack>
      <SkeletonRow>
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
      </SkeletonRow>
      <SkeletonField>
        <Bone width="24%" height={12} />
        <SkeletonToggleRow>
          <SkeletonInput />
          <SkeletonButton />
        </SkeletonToggleRow>
      </SkeletonField>
      <FilePathSkeleton />
      <SkeletonChipRow>
        <SkeletonButton />
      </SkeletonChipRow>
    </PageSkeletonFrame>
  );
}

export function DemuxSkeleton() {
  return (
    <PageSkeletonFrame>
      <SkeletonField>
        <Bone width="18%" height={12} />
        <SkeletonDropZone variant="rounded" />
      </SkeletonField>
      <SkeletonStack>
        <Bone width={120} height={20} />
        <TableSkeleton rows={4} columns={5} />
      </SkeletonStack>
      <SkeletonRow>
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
      </SkeletonRow>
      <FilePathSkeleton />
      <SkeletonStack>
        <Bone width={110} height={20} />
        <SkeletonMetaRow>
          <Bone width={120} height={12} />
          <Bone width={180} height={12} />
        </SkeletonMetaRow>
        <SkeletonMetaRow>
          <Bone width={96} height={12} />
          <Bone width={150} height={12} />
        </SkeletonMetaRow>
        <SkeletonMetaRow>
          <Bone width={110} height={12} />
          <Bone width={130} height={12} />
        </SkeletonMetaRow>
      </SkeletonStack>
      <SkeletonChipRow>
        <SkeletonButton />
      </SkeletonChipRow>
    </PageSkeletonFrame>
  );
}

export function AudioExtractSkeleton() {
  return (
    <PageSkeletonFrame>
      <SkeletonField>
        <Bone width="18%" height={12} />
        <SkeletonDropZone variant="rounded" />
      </SkeletonField>
      <FilePathSkeleton />
      <SkeletonRow>
        <FieldSkeleton />
        <FieldSkeleton />
      </SkeletonRow>
      <SkeletonDivider />
      <SkeletonStack>
        <Bone width={140} height={20} />
        <SkeletonToggleRow>
          <SkeletonSwitch />
          <Bone width={150} height={12} />
        </SkeletonToggleRow>
        <SkeletonRow>
          <FieldSkeleton />
          <FieldSkeleton />
        </SkeletonRow>
      </SkeletonStack>
      <SkeletonChipRow>
        <SkeletonButton />
      </SkeletonChipRow>
    </PageSkeletonFrame>
  );
}

export function ImageCompressSkeleton() {
  return (
    <PageSkeletonFrame>
      <SkeletonField>
        <Bone width="18%" height={12} />
        <SkeletonDropZone variant="rounded" />
      </SkeletonField>
      <FilePathSkeleton />
      <SkeletonRow>
        <FieldSkeleton />
        <FieldSkeleton />
      </SkeletonRow>
      <SkeletonRow>
        <FieldSkeleton />
        <FieldSkeleton />
      </SkeletonRow>
      <SkeletonToggleRow>
        <SkeletonSwitch />
        <Bone width={170} height={12} />
      </SkeletonToggleRow>
      <SkeletonDivider />
      <SkeletonChipRow>
        <SkeletonButton />
      </SkeletonChipRow>
    </PageSkeletonFrame>
  );
}

export function VideoCutSkeleton() {
  return (
    <PageSkeletonFrame paper={false}>
      <SectionsStack>
        <SectionCard>
          <SkeletonMetaRow>
            <Bone width={130} height={22} />
            <Bone width={110} height={24} />
          </SkeletonMetaRow>
          <SkeletonPlayer variant="rounded" />
          <SkeletonTimeline variant="rounded" />
        </SectionCard>
        <SectionCard>
          <Bone width={110} height={22} />
          <SkeletonField>
            <Bone width={120} height={12} />
            <SkeletonDropZone variant="rounded" />
          </SkeletonField>
          <FilePathSkeleton />
          <SkeletonRow>
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
          </SkeletonRow>
          <SkeletonToggleRow>
            <SkeletonSwitch />
            <Bone width={150} height={12} />
          </SkeletonToggleRow>
          <SkeletonChipRow>
            <SkeletonButton />
            <SkeletonButton />
          </SkeletonChipRow>
        </SectionCard>
      </SectionsStack>
    </PageSkeletonFrame>
  );
}

export function BatchQueueSkeleton() {
  return (
    <SkeletonStatus>
      <SkeletonPageHeaderRow>
        <TitleIcon>
          <SkeletonPageIcon variant="rounded" />
        </TitleIcon>
        <SkeletonPageTitle variant="rounded" />
        <SkeletonPushEnd>
          <SkeletonIconButton variant="rounded" />
        </SkeletonPushEnd>
      </SkeletonPageHeaderRow>
      <SkeletonStack>
        <ControlsPaper>
          <SkeletonStack>
            <ToolbarRow>
              {Array.from({ length: 7 }, (_, index) => (
                <SkeletonIconButton key={`toolbar-${index}`} variant="rounded" />
              ))}
            </ToolbarRow>
            <SkeletonFieldGrid>
              <FieldSkeleton labelWidth="42%" inputHeight={36} />
              <FieldSkeleton labelWidth="42%" inputHeight={36} />
              <FieldSkeleton labelWidth="42%" inputHeight={36} />
              <FieldSkeleton labelWidth="42%" inputHeight={36} />
            </SkeletonFieldGrid>
            <SkeletonRow>
              <FieldSkeleton />
              <SkeletonIconButton variant="rounded" />
              <SkeletonToggleRow>
                <SkeletonSwitch />
                <Bone width={110} height={12} />
              </SkeletonToggleRow>
            </SkeletonRow>
          </SkeletonStack>
        </ControlsPaper>
        <EncodingPaper>
          <SkeletonStack>
            <Bone width={140} height={20} />
            <FieldSkeleton labelWidth="26%" />
            <SkeletonFieldGrid>
              {Array.from({ length: 6 }, (_, index) => (
                <FieldSkeleton key={`encoding-${index}`} labelWidth="48%" inputHeight={36} />
              ))}
            </SkeletonFieldGrid>
          </SkeletonStack>
        </EncodingPaper>
        <SkeletonChipRow>
          {Array.from({ length: 5 }, (_, index) => (
            <Bone key={`filter-${index}`} width={88} height={24} />
          ))}
          <SkeletonPushEnd>
            <Bone width={160} height={32} />
          </SkeletonPushEnd>
        </SkeletonChipRow>
        <SkeletonStack>
          <JobCardSkeleton />
          <JobCardSkeleton />
          <JobCardSkeleton />
        </SkeletonStack>
      </SkeletonStack>
    </SkeletonStatus>
  );
}

export function LogsSkeleton() {
  return (
    <SkeletonStatus>
      <LogsRoot>
        <PageHeaderSkeleton />
        <LogsHeader>
          <Bone width={100} height={28} />
          <SkeletonSearchField variant="rounded" />
          <SkeletonIconButtonSmall variant="rounded" />
          <SkeletonIconButtonSmall variant="rounded" />
          <SkeletonPushEnd>
            <Bone width={96} height={12} />
          </SkeletonPushEnd>
        </LogsHeader>
        <LogsBody>
          {Array.from({ length: 14 }, (_, index) => (
            <SkeletonLogRow key={`log-row-${index}`}>
              <Bone width={72} height={10} />
              <Bone width={48} height={10} />
              <Bone width={56} height={10} />
              <Bone width="70%" height={10} />
            </SkeletonLogRow>
          ))}
        </LogsBody>
      </LogsRoot>
    </SkeletonStatus>
  );
}

export function SettingsSkeleton() {
  return (
    <SkeletonStatus>
      <SettingsRoot>
        <SettingsHeader>
          <SettingsTitle variant="h5" component="h1">
            <TitleIcon>
              <SkeletonPageIcon variant="rounded" />
            </TitleIcon>
            <SkeletonPageTitle variant="rounded" />
          </SettingsTitle>
        </SettingsHeader>
        <ThemeSettingsSection>
          <Bone width={130} height={20} />
          <SkeletonChipRow>
            <SkeletonThemeCard variant="rounded" />
            <SkeletonThemeCard variant="rounded" />
            <SkeletonThemeCard variant="rounded" />
          </SkeletonChipRow>
        </ThemeSettingsSection>
        <SettingsToggleSkeleton />
        <SettingsToggleSkeleton />
        <SettingsToggleSkeleton />
        <SettingsSection>
          <SkeletonSettingsLabelBlock>
            <Bone width={120} height={14} />
            <Bone width={260} height={12} />
          </SkeletonSettingsLabelBlock>
          <Bone width={180} height={40} />
        </SettingsSection>
        <SettingsSection>
          <SkeletonSettingsLabelBlock>
            <Bone width={140} height={14} />
            <Bone width={220} height={12} />
          </SkeletonSettingsLabelBlock>
          <SkeletonChipRow>
            <Bone width={110} height={36} />
            <SkeletonIconButton variant="rounded" />
          </SkeletonChipRow>
        </SettingsSection>
        <ModeSettingsSection>
          <SkeletonSettingsLabelBlock>
            <Bone width={90} height={14} />
            <Bone width={210} height={12} />
          </SkeletonSettingsLabelBlock>
          <Bone width={220} height={40} />
        </ModeSettingsSection>
        <ModeSettingsSection>
          <SkeletonSettingsLabelBlock>
            <Bone width={110} height={14} />
            <Bone width={240} height={12} />
          </SkeletonSettingsLabelBlock>
          <Bone width={220} height={40} />
        </ModeSettingsSection>
      </SettingsRoot>
    </SkeletonStatus>
  );
}

export function AboutSkeleton() {
  return (
    <PageSkeletonFrame>
      <SkeletonLogo variant="rounded" />
      <Bone width="58%" height={20} />
      <SkeletonStack>
        <Bone width="100%" height={12} />
        <Bone width="92%" height={12} />
        <Bone width="74%" height={12} />
      </SkeletonStack>
      <SkeletonDivider />
      <Bone width={150} height={22} />
      <SkeletonStack>
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonMetaRow key={`feature-${index}`}>
            <Bone width={16} height={16} />
            <Bone width={`${82 - index * 8}%`} height={12} />
          </SkeletonMetaRow>
        ))}
      </SkeletonStack>
      <SkeletonDivider />
      <SkeletonStack>
        <SkeletonMetaRow>
          <Bone width={96} height={12} />
          <Bone width={160} height={12} />
          <SkeletonButton />
        </SkeletonMetaRow>
        <SkeletonMetaRow>
          <Bone width={84} height={12} />
          <Bone width={140} height={12} />
          <SkeletonButton />
        </SkeletonMetaRow>
      </SkeletonStack>
      <SkeletonDivider />
      <Bone width={130} height={22} />
      <SkeletonStack>
        <SkeletonMetaRow>
          <Bone width={110} height={12} />
          <Bone width={130} height={12} />
        </SkeletonMetaRow>
        <SkeletonMetaRow>
          <Bone width={90} height={12} />
          <Bone width={170} height={12} />
        </SkeletonMetaRow>
        <SkeletonMetaRow>
          <Bone width={120} height={12} />
          <Bone width={100} height={12} />
        </SkeletonMetaRow>
      </SkeletonStack>
      <SkeletonDivider />
      <Bone width={110} height={22} />
      <SkeletonChipRow>
        <Bone width={140} height={36} />
        <Bone width={120} height={36} />
      </SkeletonChipRow>
    </PageSkeletonFrame>
  );
}

export function MediaInfoSkeleton() {
  return (
    <SkeletonStatus>
      <PageHeaderSkeleton />
      <SkeletonStack>
        <SkeletonDropZone variant="rounded" />
        <InfoPaper>
          <SkeletonStack>
            <Bone width={160} height={22} />
            <SkeletonMetaRow>
              <Bone width={110} height={12} />
              <Bone width={190} height={12} />
            </SkeletonMetaRow>
            <SkeletonMetaRow>
              <Bone width={90} height={12} />
              <Bone width={150} height={12} />
            </SkeletonMetaRow>
            <SkeletonMetaRow>
              <Bone width={120} height={12} />
              <Bone width={170} height={12} />
            </SkeletonMetaRow>
            <TableSkeleton rows={3} columns={5} />
          </SkeletonStack>
        </InfoPaper>
      </SkeletonStack>
    </SkeletonStatus>
  );
}

export function CopilotSkeleton() {
  return (
    <SkeletonStatus>
      <PageRoot $hasAside={false} $fill>
        <PageBody $fill>
          <SkeletonCopilotLayout>
            <SkeletonChatArea>
              <Bone width={240} height={30} />
              <Bone width={340} height={14} />
              <SkeletonChipRow>
                <Bone width={150} height={32} />
                <Bone width={180} height={32} />
                <Bone width={130} height={32} />
              </SkeletonChipRow>
            </SkeletonChatArea>
            <SkeletonComposer>
              <SkeletonComposerShell variant="rounded" />
              <SkeletonChipRow>
                <Bone width={120} height={30} />
                <Bone width={96} height={30} />
                <Bone width={140} height={30} />
              </SkeletonChipRow>
              <Bone width={220} height={10} />
            </SkeletonComposer>
          </SkeletonCopilotLayout>
        </PageBody>
      </PageRoot>
    </SkeletonStatus>
  );
}
