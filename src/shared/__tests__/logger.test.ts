import { describe, it, expect, vi, beforeEach } from 'vitest';

async function loadLogger(level?: string) {
  if (level) process.env.LOG_LEVEL = level;
  else delete process.env.LOG_LEVEL;
  vi.resetModules();
  return import('../logger');
}

describe('Logger', () => {
  beforeEach(() => {
    delete process.env.LOG_LEVEL;
    vi.resetModules();
  });

  it('exposes the LogLevel enum', async () => {
    const { LogLevel } = await loadLogger();
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
  });

  it('logs all levels at the default DEBUG level', async () => {
    const { Logger } = await loadLogger();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = new Logger('ctx');
    log.debug('d', 1);
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] [ctx]'), 'd', 1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] [ctx]'), 'i');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN] [ctx]'), 'w');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] [ctx]'), 'e');
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('suppresses debug when LOG_LEVEL=INFO', async () => {
    const { Logger } = await loadLogger('INFO');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = new Logger('ctx');
    log.debug('hidden');
    log.info('shown');
    log.warn('warned');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] [ctx]'), 'shown');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('suppresses debug and info when LOG_LEVEL=WARN', async () => {
    const { Logger } = await loadLogger('WARN');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = new Logger('ctx');
    log.debug('hidden');
    log.info('hidden');
    log.warn('warned');
    log.error('err');
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('suppresses everything below error when LOG_LEVEL=ERROR', async () => {
    const { Logger } = await loadLogger('ERROR');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = new Logger('ctx');
    log.debug('hidden');
    log.info('hidden');
    log.warn('hidden');
    log.error('err');
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('falls back to DEBUG for an unknown LOG_LEVEL value', async () => {
    const { Logger } = await loadLogger('BOGUS');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    new Logger('ctx').debug('shown');
    expect(logSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });
});
