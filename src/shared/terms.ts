/**
 * @fileoverview Terms & Conditions content for EncodeX.
 *
 * The agreement is versioned and structured: bump {@link TERMS_VERSION} whenever the
 * text changes so existing users who already accepted an older version are prompted to
 * accept the updated terms on their next launch. The content is deliberately kept in
 * English (like the license text on the About page); the dialog chrome (title, buttons)
 * is localized via i18n.
 *
 * Sections are rendered by TermsDialog in order. Each section has a short heading and a
 * list of body paragraphs.
 */

/**
 * Version of the current Terms & Conditions, used as the acceptance marker persisted to
 * localStorage. Date-based so an edit surfaces as an obvious "effective" change; bump it
 * (e.g. `2026-09-16` -> `2026-12-01`) after any edit to re-prompt existing users.
 * @const {string} TERMS_VERSION
 */
export const TERMS_VERSION = '2026-09-16';

/**
 * A single terms section: a heading plus the paragraphs rendered beneath it.
 * @interface TermsSection
 * @property {string} title - Section heading.
 * @property {string[]} body - Paragraphs in this section.
 */
export interface TermsSection {
  title: string;
  body: string[];
}

/**
 * The full Terms & Conditions document, rendered in the acceptance gate and the About
 * page viewer. Keep paragraphs concise; long legal copy should be split into more
 * sections for readability.
 * @const {readonly TermsSection[]} TERMS_SECTIONS
 */
export const TERMS_SECTIONS: readonly TermsSection[] = [
  {
    title: 'Introduction',
    body: [
      'Welcome to EncodeX, a free and open-source multimedia conversion toolkit built on FFmpeg. By downloading, installing, or using the application, you agree to these Terms and Conditions. If you do not agree with any part of them, you must not use the application.',
    ],
  },
  {
    title: 'Use of the Application',
    body: [
      'EncodeX is provided for the conversion, inspection, compression, extraction, cutting, and batch processing of audio, video, and image files. You are responsible for the media you process and for ensuring you have the legal right to use and modify any files you work with.',
      'You agree not to use EncodeX for any unlawful activity, to disrupt or abuse the software or the systems it runs on, or to violate the rights of others.',
    ],
  },
  {
    title: 'License',
    body: [
      'EncodeX is licensed under the MIT License. You are free to use, copy, modify, merge, publish, distribute, sublicense, and sell the software — including commercially — provided the copyright and permission notices are included in all copies or substantial portions of the software.',
    ],
  },
  {
    title: 'Intellectual Property',
    body: [
      'The EncodeX name, logo, and documentation are the property of their respective owners. Nothing in these Terms grants you a right to use any trademark, logo, or branding of EncodeX or its contributors without prior written permission.',
    ],
  },
  {
    title: 'Privacy and User Data',
    body: [
      'EncodeX runs locally on your machine. Your media files and conversion settings are processed on your device and are not uploaded to any server by the application itself.',
      'If you choose to enable error monitoring, technical diagnostic data (such as error messages and system information) may be transmitted to a third-party monitoring service to help improve the application. No media content or personal documents are collected. You can disable error monitoring at any time in Settings.',
    ],
  },
  {
    title: 'Third-Party Components',
    body: [
      'EncodeX bundles and depends on third-party open-source components, including FFmpeg. These components are governed by their own licenses, which are attributed in the application and its documentation.',
    ],
  },
  {
    title: 'No Warranty',
    body: [
      'The application is provided "as is", without warranty of any kind, either express or implied, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, and non-infringement. You use EncodeX at your own risk.',
    ],
  },
  {
    title: 'Limitation of Liability',
    body: [
      'In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the application or its use, including the loss of data or media files. Always keep backups of your original files before processing them.',
    ],
  },
  {
    title: 'Changes to These Terms',
    body: [
      'We may update these Terms and Conditions from time to time. When the terms change, the application will show you the updated version on your next launch and ask you to accept it before you can continue using EncodeX.',
    ],
  },
  {
    title: 'Termination',
    body: [
      'These Terms remain in effect while you use EncodeX. You may stop using the application at any time. We may update, modify, or discontinue the application, or these Terms, at any time without notice.',
    ],
  },
  {
    title: 'Governing Law',
    body: [
      'These Terms are governed by the laws applicable to your jurisdiction and the jurisdiction of the application authors, to the extent permitted by applicable law. If any provision of these Terms is found to be unenforceable, the remaining provisions remain in full force and effect.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'If you have any questions about these Terms and Conditions, you can reach out through the official repository or the contact email listed on the About page.',
    ],
  },
];
