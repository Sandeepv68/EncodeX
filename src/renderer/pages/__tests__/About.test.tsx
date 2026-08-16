import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import About from '../About';
import { assertNoAxeViolations } from '../../../test-utils/axe';

const AUTHOR_GITHUB_URL = 'https://github.com/Sandeepv68';
const REPOSITORY_URL = 'https://github.com/Sandeepv68/EncodeX';
const ISSUES_URL = `${REPOSITORY_URL}/issues`;
const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;

describe('About', () => {
  it('has no axe violations', async () => {
    const { container } = render(<About />);
    await assertNoAxeViolations(container);
  });

  it('renders the page title and subtitle', () => {
    render(<About />);
    expect(screen.getByText('about.title')).toBeInTheDocument();
    expect(screen.getByText('about.subtitle')).toBeInTheDocument();
  });

  it('renders the detailed product description', () => {
    render(<About />);
    expect(screen.getByText('about.description')).toBeInTheDocument();
  });

  it('shows the application logo', () => {
    render(<About />);
    const logo = screen.getByRole('img', { name: 'about.logoAlt' });
    expect(logo.tagName).toBe('IMG');
  });

  it('lists the feature highlights', () => {
    render(<About />);
    expect(screen.getByText('dashboard.descConvert')).toBeInTheDocument();
    expect(screen.getByText('dashboard.descBatch')).toBeInTheDocument();
  });

  it('shows the installed version and tech stack', () => {
    render(<About />);
    expect(screen.getByText('about.version')).toBeInTheDocument();
    expect(screen.getByText('about.builtWith')).toBeInTheDocument();
    expect(screen.getByText('FFmpeg, React, TypeScript, Electron')).toBeInTheDocument();
  });

  it('links the author name to the GitHub profile', () => {
    render(<About />);
    const authorLink = screen.getByRole('link', { name: 'Sandeep Vattapparambil' });
    expect(authorLink).toHaveAttribute('href', AUTHOR_GITHUB_URL);
    expect(authorLink).toHaveAttribute('target', '_blank');
  });

  it('links the repository to its GitHub page', () => {
    render(<About />);
    const repoLink = screen.getByRole('link', { name: 'github.com/Sandeepv68/EncodeX' });
    expect(repoLink).toHaveAttribute('href', REPOSITORY_URL);
    expect(repoLink).toHaveAttribute('target', '_blank');
  });

  it('offers a feedback link to the issue tracker', () => {
    render(<About />);
    expect(screen.getByText('about.feedback')).toBeInTheDocument();
    const issueLink = screen.getByRole('link', { name: 'about.reportIssue' });
    expect(issueLink).toHaveAttribute('href', ISSUES_URL);
    expect(issueLink).toHaveAttribute('target', '_blank');
  });

  it('shows the license with a link to the LICENSE file', () => {
    render(<About />);
    expect(screen.getByText('about.licenseTitle')).toBeInTheDocument();
    const licenseLink = screen.getByRole('link', { name: 'about.licenseName' });
    expect(licenseLink).toHaveAttribute('href', LICENSE_URL);
    expect(licenseLink).toHaveAttribute('target', '_blank');
    expect(screen.getByText('about.copyright')).toBeInTheDocument();
    expect(screen.getByText('about.licenseSummary')).toBeInTheDocument();
  });

  it('renders the acknowledgement caption', () => {
    render(<About />);
    expect(screen.getByText('about.acknowledgements')).toBeInTheDocument();
  });
});
