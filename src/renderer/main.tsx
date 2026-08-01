import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { Logger } from '../shared/logger';
import App from './App';
import i18n from './i18n/config';
import { DirectionProvider } from './i18n/DirectionProvider';
import { useLanguageDirection } from './useLanguageDirection';
import { useLogStore } from './stores/logStore';

const log = new Logger('renderer/main');

const levels: Array<{ method: 'log' | 'warn' | 'error'; level: 'INFO' | 'WARN' | 'ERROR' }> = [
  { method: 'log', level: 'INFO' },
  { method: 'warn', level: 'WARN' },
  { method: 'error', level: 'ERROR' },
];
for (const { method, level } of levels) {
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    original.apply(console, args);
    const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    useLogStore.getState().addEntry({
      timestamp: new Date().toISOString(),
      level: level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
      text,
      source: 'renderer',
    });
  };
}

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
