import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  runConvertMock,
  createCliTranscoderMock,
  runInfoMock,
  runCapabilitiesMock,
  runCompressMock,
  runExtractAudioMock,
  runBatchMock,
  fakeTranscoder,
} = vi.hoisted(() => {
  const fakeTranscoder = { getType: vi.fn(() => 'FFMPEG') };
  return {
    runConvertMock: vi.fn().mockResolvedValue(undefined),
    createCliTranscoderMock: vi.fn(() => fakeTranscoder),
    runInfoMock: vi.fn().mockResolvedValue(undefined),
    runCapabilitiesMock: vi.fn().mockResolvedValue(undefined),
    runCompressMock: vi.fn().mockResolvedValue(undefined),
    runExtractAudioMock: vi.fn().mockResolvedValue(undefined),
    runBatchMock: vi.fn().mockResolvedValue(undefined),
    fakeTranscoder,
  };
});

vi.mock('../cli/cli-convert', () => ({
  runConvert: runConvertMock,
  createCliTranscoder: createCliTranscoderMock,
}));
vi.mock('../cli/cli-info', () => ({ runInfo: runInfoMock, runCapabilities: runCapabilitiesMock }));
vi.mock('../cli/cli-compress', () => ({ runCompress: runCompressMock, runExtractAudio: runExtractAudioMock }));
vi.mock('../cli/cli-batch', () => ({ runBatch: runBatchMock }));

const { runCli, mapCliErrorToExitCode } = await import('../cli/cli');
const { CliExitError } = await import('../cli/cli-options');

const ORIGINAL_ARGV = process.argv;

describe('runCli (subcommand entry)', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.fn>;
  let stderrWriteSpy: ReturnType<typeof vi.fn>;

  function setArgs(args: string[]): void {
    process.argv = ['node', 'C:\\project\\index.js', ...args];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    runConvertMock.mockResolvedValue(undefined);
    runInfoMock.mockResolvedValue(undefined);
    runCapabilitiesMock.mockResolvedValue(undefined);
    runCompressMock.mockResolvedValue(undefined);
    runExtractAudioMock.mockResolvedValue(undefined);
    runBatchMock.mockResolvedValue(undefined);
    createCliTranscoderMock.mockReturnValue(fakeTranscoder);
  });

  afterEach(() => {
    process.argv = ORIGINAL_ARGV;
    stdoutWriteSpy.mockRestore();
    stderrWriteSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('dispatches the convert subcommand with positional args', async () => {
    setArgs(['convert', 'in.mp4', 'out.mp4']);
    await runCli();
    expect(createCliTranscoderMock).toHaveBeenCalledWith('FFMPEG');
    expect(runConvertMock).toHaveBeenCalledWith(expect.objectContaining({ input: 'in.mp4', output: 'out.mp4', themeId: 'light' }));
  });

  it('resolves the transcoder global from before or after the subcommand', async () => {
    setArgs(['--transcoder', 'FFTOOL', 'info', 'in.mp4']);
    await runCli();
    expect(createCliTranscoderMock).toHaveBeenCalledWith('FFTOOL');

    createCliTranscoderMock.mockClear();
    setArgs(['info', 'in.mp4', '--transcoder', 'BMF']);
    await runCli();
    expect(createCliTranscoderMock).toHaveBeenCalledWith('BMF');
  });

  it('prefers an explicitly set transcoder over the default', async () => {
    setArgs(['--transcoder', 'FFTOOL', 'info', 'in.mp4', '--transcoder', 'BMF']);
    await runCli();
    expect(createCliTranscoderMock).toHaveBeenCalledWith('BMF');
  });

  it('shims legacy positional usage into the convert subcommand', async () => {
    setArgs(['in.mp4', 'out.mp4']);
    await runCli();
    expect(runConvertMock).toHaveBeenCalledWith(expect.objectContaining({ input: 'in.mp4', output: 'out.mp4' }));
  });

  it('shims legacy --info into the info subcommand', async () => {
    setArgs(['--info', 'in.mp4']);
    await runCli();
    expect(runInfoMock).toHaveBeenCalledWith(fakeTranscoder, 'in.mp4', false, 'light');
  });

  it('routes convert --info to the info handler', async () => {
    setArgs(['convert', '--info', 'in.mp4']);
    await runCli();
    expect(runInfoMock).toHaveBeenCalledWith(fakeTranscoder, 'in.mp4', false, 'light');
    expect(runConvertMock).not.toHaveBeenCalled();
  });

  it('runs the info subcommand with JSON when --json is passed before it', async () => {
    setArgs(['--json', 'info', 'in.mp4']);
    await runCli();
    expect(runInfoMock).toHaveBeenCalledWith(fakeTranscoder, 'in.mp4', true, 'light');
  });

  it('runs the capabilities subcommand', async () => {
    setArgs(['capabilities']);
    await runCli();
    expect(runCapabilitiesMock).toHaveBeenCalledWith(false, 'light');
  });

  it('runs the compress subcommand with its flags', async () => {
    setArgs(['compress', 'photo.png', '--format', 'webp']);
    await runCli();
    expect(runCompressMock).toHaveBeenCalledWith(
      'photo.png',
      expect.objectContaining({ format: 'webp' }),
      fakeTranscoder,
      expect.any(Number),
      'light',
    );
  });

  it('runs the extract-audio subcommand with its flags', async () => {
    setArgs(['extract-audio', 'video.mkv']);
    await runCli();
    expect(runExtractAudioMock).toHaveBeenCalledWith('video.mkv', expect.objectContaining({}), fakeTranscoder, expect.any(Number), 'light');
  });

  it('runs the batch subcommand with collected inputs', async () => {
    setArgs(['batch', 'a.mp4', 'b.mp4']);
    await runCli();
    expect(runBatchMock).toHaveBeenCalledWith(expect.objectContaining({ inputs: ['a.mp4', 'b.mp4'], transcoder: 'FFMPEG' }));
  });

  it('prints help and skips dispatch for a bare invocation', async () => {
    setArgs([]);
    await runCli();
    expect(runConvertMock).not.toHaveBeenCalled();
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });

  it('returns successfully when --help is passed', async () => {
    setArgs(['--help']);
    await expect(runCli()).resolves.toBeUndefined();
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });

  it('rejects with a usage CliExitError for unknown options', async () => {
    setArgs(['--bogus']);
    await expect(runCli()).rejects.toMatchObject({ name: 'CliExitError', exitCode: 2 });
  });

  it('rejects with a usage CliExitError when convert lacks an input', async () => {
    setArgs(['convert']);
    await expect(runCli()).rejects.toMatchObject({ name: 'CliExitError', exitCode: 2 });
  });

  it('rejects with a usage CliExitError for convert --info without input', async () => {
    setArgs(['convert', '--info']);
    await expect(runCli()).rejects.toMatchObject({ name: 'CliExitError', exitCode: 2 });
  });

  it('exposes CliExitError exit codes through mapCliErrorToExitCode', () => {
    expect(mapCliErrorToExitCode(new CliExitError('x', 7))).toBe(7);
  });
});
