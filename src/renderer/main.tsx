import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { Logger } from '../shared/logger';
import App from './App';
import i18n from './i18n/config';
import { DirectionProvider } from './i18n/DirectionProvider';
import { useLanguageDirection } from './useLanguageDirection';

const log = new Logger('renderer/main');

function Root() {
  const direction = useLanguageDirection();

  return (
    <HashRouter>
      <DirectionProvider direction={direction}>
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </DirectionProvider>
    </HashRouter>
  );
}

log.info('Mounting React app');
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
