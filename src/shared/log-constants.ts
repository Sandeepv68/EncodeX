/**
 * @fileoverview Shared log message constants extracted from source files.
 * Centralizes the hardcoded strings passed to log.*() calls across main and
 * renderer, so log output stays consistent and typos are caught at compile time.
 * Each constant is the literal message text used when the corresponding event
 * is logged, often followed by the interpolated value(s) from the call site.
 */

/** @const {string} Logged when an 'activate' event fires while the main window is null. */
export const LOG_ACTIVATE_EVENT_MAIN_WINDOW_NULL = 'Activate event, mainWindow null:';
/** @const {string} Logged when a batch queue job is added (addJob). */
export const LOG_ADD_JOB = 'addJob:';
/** @const {string} Logged with the current platform when all windows have closed. */
export const LOG_ALL_WINDOWS_CLOSED_PLATFORM = 'All windows closed, platform:';
/** @const {string} Logged when the app is ready and splash/main windows are being created. */
export const LOG_APP_READY_CREATING_SPLASH_AND_MAIN_WINDOWS = 'App ready, creating splash and main windows';
/** @const {string} Logged before applying hardware acceleration flags for a given encoder. */
export const LOG_APPLYING_HARDWARE_ACCELERATION_FLAGS_FOR = 'Applying hardware acceleration flags for';
/** @const {string} Arrow separator used in log messages. */
export const LOG_ARROW = '->';
/** @const {string} Prefix when logging an audio value. */
export const LOG_AUDIO = 'audio:';
/** @const {string} Prefix when logging an audio bitrate value. */
export const LOG_AUDIO_BITRATE = 'Audio bitrate:';
/** @const {string} Prefix when logging an audio codec value. */
export const LOG_AUDIO_CODEC = 'Audio codec:';
/** @const {string} Logged when the player audio context is created. */
export const LOG_AUDIO_CONTEXT_CREATED = 'Audio context created';
/** @const {string} Logged when audio output is disabled and the output will have no audio stream. */
export const LOG_AUDIO_DISABLED_OUTPUT_WILL_HAVE_NO_AUDIO_STREAM = 'Audio disabled, output will have no audio stream';
/** @const {string} Prefix when auto-suggesting an output file path. */
export const LOG_AUTO_SUGGESTING_OUTPUT_FILE = 'Auto-suggesting output file:';
/** @const {string} Prefix when logging a BMF CLI command. */
export const LOG_BMF_COMMAND = 'BMF command:';
/** @const {string} Prefix when a BMF process exits with a non-zero code. */
export const LOG_BMF_EXITED_WITH_CODE = 'BMF exited with code:';
/** @const {string} Prefix when logging a BMF ffprobe command. */
export const LOG_BMF_FFPROBE_COMMAND = 'BMF ffprobe command:';
/** @const {string} Logged when a BMF process is cancelled. */
export const LOG_BMF_PROCESS_CANCELLED = 'BMF process cancelled';
/** @const {string} Logged when a BMF process completes successfully. */
export const LOG_BMF_PROCESS_COMPLETED_SUCCESSFULLY = 'BMF process completed successfully';
/** @const {string} Prefix when a BMF process reports an error. */
export const LOG_BMF_PROCESS_ERROR = 'BMF process error:';
/** @const {string} Prefix when a BMF process fails with a given code. */
export const LOG_BMF_PROCESS_FAILED_WITH_CODE = 'BMF process failed with code:';
/** @const {string} Logged when a BMF process is killed. */
export const LOG_BMF_PROCESS_KILLED = 'BMF process killed';
/** @const {string} Prefix when spawning a BMF process throws. */
export const LOG_BMF_SPAWN_ERROR = 'BMF spawn error:';
/** @const {string} Logged when the queue is being cleared by cancelAll. */
export const LOG_CANCEL_ALL_CLEARING = 'cancelAll - clearing';
/** @const {string} Logged when cancelConversion is invoked. */
export const LOG_CANCEL_CONVERSION_CALLED = 'cancelConversion called';
/** @const {string} Logged when an extraction (waveform/thumbnail) is cancelled. */
export const LOG_CANCEL_EXTRACT = 'cancelExtract';
/** @const {string} Prefix when cancelling a specific queue job. */
export const LOG_CANCEL_JOB = 'cancelJob:';
/** @const {string} Logged when the active job is being cancelled. */
export const LOG_CANCELLING_ACTIVE_JOB = 'Cancelling active job';
/** @const {string} Logged when the current BMF process is being cancelled. */
export const LOG_CANCELLING_CURRENT_BMF_PROCESS = 'Cancelling current BMF process';
/** @const {string} Logged when the current FFmpeg process is being cancelled. */
export const LOG_CANCELLING_CURRENT_FFMPEG_PROCESS = 'Cancelling current FFmpeg process';
/** @const {string} Logged when a video cut job is being cancelled. */
export const LOG_CANCELLING_CUT_JOB = 'Cancelling cut job';
/** @const {string} Logged when the job list is cleared (clearJobs). */
export const LOG_CLEAR_JOBS = 'clearJobs';
/** @const {string} Logged when the current selection is cleared (clearSelection). */
export const LOG_CLEAR_SELECTION = 'clearSelection';
/** @const {string} Logged when the video cut form is cleared. */
export const LOG_CLEARING_VIDEO_CUT_FORM = 'Clearing video cut form';
/** @const {string} Logged when a CLI process completes successfully. */
export const LOG_CLI_COMPLETED_SUCCESSFULLY = 'CLI completed successfully';
/** @const {string} Logged when a CLI conversion completes successfully. */
export const LOG_CLI_CONVERSION_COMPLETED_SUCCESSFULLY = 'CLI conversion completed successfully';
/** @const {string} Prefix when a CLI conversion fails. */
export const LOG_CLI_CONVERSION_FAILED = 'CLI conversion failed:';
/** @const {string} Prefix when a CLI process fails. */
export const LOG_CLI_FAILED = 'CLI failed:';
/** @const {string} Value logged when a window 'close' event fires. */
export const LOG_CLOSE = 'close';
/** @const {string} Logged when the player is being closed. */
export const LOG_CLOSING_PLAYER = 'Closing player';
/** @const {string} Prefix when logging a codec value. */
export const LOG_CODEC = 'codec:';
/** @const {string} Prefix when compressing an image file. */
export const LOG_COMPRESSING_IMAGE = 'Compressing image:';
/** @const {string} Logged when a conversion is cancelled. */
export const LOG_CONVERSION_CANCELLED = 'Conversion cancelled';
/** @const {string} Logged when a conversion completes successfully. */
export const LOG_CONVERSION_COMPLETED_SUCCESSFULLY = 'Conversion completed successfully';
/** @const {string} Prefix when a conversion fails. */
export const LOG_CONVERSION_FAILED = 'Conversion failed:';
/** @const {string} Logged when a conversion times out after 300 seconds. */
export const LOG_CONVERSION_TIMED_OUT_AFTER_300S = 'Conversion timed out after 300s';
/** @const {string} Prefix when a conversion is started (convert). */
export const LOG_CONVERT = 'convert:';
/** @const {string} Prefix when convertFile is invoked. */
export const LOG_CONVERT_FILE = 'convertFile:';
/** @const {string} Prefix when logging a stream copy value. */
export const LOG_COPY = 'copy:';
/** @const {string} Prefix when logging a copy mode value. */
export const LOG_COPY_MODE = 'copyMode:';
/** @const {string} Logged when the main window is being created. */
export const LOG_CREATING_MAIN_WINDOW = 'Creating main window';
/** @const {string} Logged when the splash window is being created. */
export const LOG_CREATING_SPLASH_WINDOW = 'Creating splash window';
/** @const {string} Prefix when a transcoder instance is created. */
export const LOG_CREATING_TRANSCODER = 'Creating transcoder:';
/** @const {string} Prefix when cutting a video. */
export const LOG_CUTTING_VIDEO = 'Cutting video:';
/** @const {string} Logged after the Dashboard renders. */
export const LOG_DASHBOARD_RENDERED = 'Dashboard rendered';
/** @const {string} Prefix when a decoder exits with a non-zero code. */
export const LOG_DECODER_EXITED_WITH_NON_ZERO_CODE = 'Decoder exited with non-zero code:';
/** @const {string} Prefix when a decoder process reports an error. */
export const LOG_DECODER_PROCESS_ERROR = 'Decoder process error:';
/** @const {string} Prefix when a decoder process exits with a code. */
export const LOG_DECODER_PROCESS_EXITED_WITH_CODE = 'Decoder process exited with code:';
/** @const {string} Logged when a decoder process is killed. */
export const LOG_DECODER_PROCESS_KILLED = 'Decoder process killed';
/** @const {string} Prefix when FFmpeg capabilities have been detected. */
export const LOG_DETECTED_FFMPEG_CAPABILITIES = 'Detected ffmpeg capabilities:';
/** @const {string} Prefix when logging a duration value. */
export const LOG_DURATION = 'duration:';
/** @const {string} Prefix when logging a capitalized Duration value. */
export const LOG_DURATION_CAPITALIZED = 'Duration:';
/** @const {string} Prefix when an encoder capability probe fails. */
export const LOG_ENCODER_CAPABILITY_PROBE_FAILED = 'Encoder capability probe failed:';
/** @const {string} Prefix when logging an end time value. */
export const LOG_END_TIME = 'End time:';
/** @const {string} Prefix when the ErrorBoundary catches an error. */
export const LOG_ERROR_BOUNDARY_CAUGHT = 'ErrorBoundary caught:';
/** @const {string} Logged when an error is cleared. */
export const LOG_ERROR_CLEARED = 'Error cleared';
/** @const {string} Logged when the error history is cleared. */
export const LOG_ERROR_HISTORY_CLEARED = 'Error history cleared';
/** @const {string} Prefix when an error message is shown. */
export const LOG_ERROR_MESSAGE_SHOWN = 'Error message shown:';
/** @const {string} Prefix when an error is shown. */
export const LOG_ERROR_SHOWN = 'Error shown:';
/** @const {string} Prefix when EXIF parsing fails. */
export const LOG_EXIF_PARSE_FAILED = 'EXIF parse failed:';
/** @const {string} Prefix when extractThumbnails is invoked. */
export const LOG_EXTRACT_THUMBNAILS = 'extractThumbnails:';
/** @const {string} Prefix when extractWaveform is invoked. */
export const LOG_EXTRACT_WAVEFORM = 'extractWaveform:';
/** @const {string} Prefix when extracting audio from a file. */
export const LOG_EXTRACTING_AUDIO = 'Extracting audio:';
/** @const {string} Logged when an audio extraction completes successfully. */
export const LOG_EXTRACTION_COMPLETED_SUCCESSFULLY = 'Extraction completed successfully';
/** @const {string} Prefix when an audio extraction fails. */
export const LOG_EXTRACTION_FAILED = 'Extraction failed:';
/** @const {string} Prefix when cleaning up a partial output file fails. */
export const LOG_FAILED_TO_CLEAN_UP_PARTIAL_OUTPUT = 'Failed to clean up partial output:';
/** @const {string} Prefix when clearing transient storage fails. */
export const LOG_FAILED_TO_CLEAR_TRANSIENT_STORAGE = 'Failed to clear transient storage:';
/** @const {string} Prefix when thumbnail extraction fails. */
export const LOG_FAILED_TO_EXTRACT_THUMBNAILS = 'Failed to extract thumbnails:';
/** @const {string} Prefix when waveform extraction fails. */
export const LOG_FAILED_TO_EXTRACT_WAVEFORM = 'Failed to extract waveform:';
/** @const {string} Prefix when getting media info fails. */
export const LOG_FAILED_TO_GET_MEDIA_INFO = 'Failed to get media info:';
/** @const {string} Prefix when loading media info fails. */
export const LOG_FAILED_TO_LOAD_MEDIA_INFO = 'Failed to load media info:';
/** @const {string} Prefix when loading media info for a preview fails. */
export const LOG_FAILED_TO_LOAD_MEDIA_INFO_FOR_PREVIEW = 'Failed to load media info for preview:';
/** @const {string} Prefix when persisting the always-on-top setting fails. */
export const LOG_FAILED_TO_PERSIST_ALWAYS_ON_TOP_SETTING = 'Failed to persist always-on-top setting:';
/** @const {string} Prefix when persisting the launch-at-login setting fails. */
export const LOG_FAILED_TO_PERSIST_LAUNCH_AT_LOGIN_SETTING = 'Failed to persist launch-at-login setting:';
/** @const {string} Prefix when persisting the batch queue concurrency fails. */
export const LOG_FAILED_TO_PERSIST_QUEUE_CONCURRENCY = 'Failed to persist queue concurrency:';
/** @const {string} Prefix when persisting hardware acceleration settings fails. */
export const LOG_FAILED_TO_PERSIST_HARDWARE_ACCELERATION_SETTINGS = 'Failed to persist hardware acceleration settings:';
/** @const {string} Prefix when persisting the video cut draft fails. */
export const LOG_FAILED_TO_PERSIST_VIDEO_CUT_DRAFT = 'Failed to persist video cut draft:';

export const LOG_FAILED_TO_PERSIST_BATCH_CONFIG = 'Failed to persist batch config:';
/** @const {string} Prefix when reading image dimensions fails. */
export const LOG_FAILED_TO_READ_IMAGE_DIMENSIONS = 'Failed to read image dimensions:';
/** @const {string} Prefix when reading an image preview fails. */
export const LOG_FAILED_TO_READ_IMAGE_PREVIEW = 'Failed to read image preview:';
/** @const {string} Prefix when reading the stored always-on-top setting fails. */
export const LOG_FAILED_TO_READ_STORED_ALWAYS_ON_TOP_SETTING = 'Failed to read stored always-on-top setting:';
/** @const {string} Prefix when reading the stored launch-at-login setting fails. */
export const LOG_FAILED_TO_READ_STORED_LAUNCH_AT_LOGIN_SETTING = 'Failed to read stored launch-at-login setting:';
/** @const {string} Prefix when reading the stored queue concurrency fails. */
export const LOG_FAILED_TO_READ_STORED_QUEUE_CONCURRENCY = 'Failed to read stored queue concurrency:';
/** @const {string} Prefix when reading stored hardware acceleration settings fails. */
export const LOG_FAILED_TO_READ_STORED_HARDWARE_ACCELERATION_SETTINGS = 'Failed to read stored hardware acceleration settings:';
/** @const {string} Prefix when reading the stored video cut draft fails. */
export const LOG_FAILED_TO_READ_STORED_VIDEO_CUT_DRAFT = 'Failed to read stored video cut draft:';

export const LOG_FAILED_TO_READ_STORED_BATCH_CONFIG = 'Failed to read stored batch config:';
/** @const {string} Prefix when resuming a process fails. */
export const LOG_FAILED_TO_RESUME_PROCESS = 'Failed to resume process:';
/** @const {string} Prefix when statting an image file fails. */
export const LOG_FAILED_TO_STAT_IMAGE_FILE = 'Failed to stat image file:';
/** @const {string} Prefix when suspending a process fails. */
export const LOG_FAILED_TO_SUSPEND_PROCESS = 'Failed to suspend process:';
/** @const {string} Prefix when logging an FFmpeg command. */
export const LOG_FFMPEG_COMMAND = 'FFmpeg command:';
/** @const {string} Prefix when logging FFmpeg decoder arguments. */
export const LOG_FFMPEG_DECODER_ARGS = 'FFmpeg decoder args:';
/** @const {string} Prefix when an FFmpeg process exits with a code. */
export const LOG_FFMPEG_EXITED_WITH_CODE = 'FFmpeg exited with code:';
/** @const {string} Prefix when the FFmpeg path is set. */
export const LOG_FFMPEG_PATH_SET_TO = 'FFmpeg path set to:';
/** @const {string} Logged when an FFmpeg process is cancelled. */
export const LOG_FFMPEG_PROCESS_CANCELLED = 'FFmpeg process cancelled';
/** @const {string} Logged when an FFmpeg process completes successfully. */
export const LOG_FFMPEG_PROCESS_COMPLETED_SUCCESSFULLY = 'FFmpeg process completed successfully';
/** @const {string} Logged when an FFmpeg process ends successfully. */
export const LOG_FFMPEG_PROCESS_ENDED_SUCCESSFULLY = 'FFmpeg process ended successfully';
/** @const {string} Prefix when an FFmpeg process reports an error. */
export const LOG_FFMPEG_PROCESS_ERROR = 'FFmpeg process error:';
/** @const {string} Prefix when an FFmpeg process fails with a code. */
export const LOG_FFMPEG_PROCESS_FAILED_WITH_CODE = 'FFmpeg process failed with code:';
/** @const {string} Logged when an FFmpeg process is killed. */
export const LOG_FFMPEG_PROCESS_KILLED = 'FFmpeg process killed';
/** @const {string} Prefix when an FFmpeg process is started. */
export const LOG_FFMPEG_PROCESS_STARTED = 'FFmpeg process started:';
/** @const {string} Prefix when spawning FFmpeg throws. */
export const LOG_FFMPEG_SPAWN_ERROR = 'ffmpeg spawn error:';
/** @const {string} Logged when ffmpeg-static is missing and the app falls back to system ffmpeg. */
export const LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG = 'ffmpeg-static not found, falling back to system ffmpeg';
/** @const {string} Prefix when logging ffprobe arguments. */
export const LOG_FFPROBE_ARGS = 'ffprobe args:';
/** @const {string} Prefix when ffprobe exits with a code. */
export const LOG_FFPROBE_EXITED_WITH_CODE = 'ffprobe exited with code:';
/** @const {string} Prefix when the FFprobe path is set. */
export const LOG_FFPROBE_PATH_SET_TO = 'FFprobe path set to:';
/** @const {string} Logged when ffprobe-static is missing and the app falls back to system ffprobe. */
export const LOG_FFPROBE_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFPROBE = 'ffprobe-static not found, falling back to system ffprobe';
/** @const {string} Prefix when a file is dropped onto the window. */
export const LOG_FILE_DROPPED = 'File dropped:';
/** @const {string} Prefix when a file is selected. */
export const LOG_FILE_SELECTED = 'File selected:';
/** @const {string} Prefix when a stalled frame is force-drawn at a timestamp. */
export const LOG_FORCE_DREW_STALLED_FRAME_AT = 'Force-drew stalled frame at';
/** @const {string} Logged when full-range color is forced for MJPEG output. */
export const LOG_FORCING_FULL_RANGE_COLOR_FOR_MJPEG_OUTPUT = 'Forcing full-range color for MJPEG output';
/** @const {string} Prefix when logging a format value. */
export const LOG_FORMAT = 'format:';
/** @const {string} Logged when getCapabilities is invoked. */
export const LOG_GET_CAPABILITIES_CALLED = 'getCapabilities called';
/** @const {string} Prefix when getImageFileInfo is invoked. */
export const LOG_GET_IMAGE_FILE_INFO = 'getImageFileInfo:';
/** @const {string} Prefix when getImageInfo is invoked. */
export const LOG_GET_IMAGE_INFO = 'getImageInfo:';
/** @const {string} Prefix when getImagePreview is invoked. */
export const LOG_GET_IMAGE_PREVIEW = 'getImagePreview:';
/** @const {string} Prefix when getInfo is invoked. */
export const LOG_GET_INFO = 'getInfo:';
/** @const {string} Prefix when getInfo completes. */
export const LOG_GET_INFO_COMPLETED = 'getInfo completed:';
/** @const {string} Prefix when getInfo fails because BMF is not available. */
export const LOG_GET_INFO_FAILED_BMF_NOT_AVAILABLE = 'getInfo failed - BMF not available:';
/** @const {string} Prefix when the ffprobe run in getInfo fails. */
export const LOG_GET_INFO_FFPROBE_FAILED = 'getInfo ffprobe failed:';
/** @const {string} Prefix when the ffprobe spawn in getInfo throws. */
export const LOG_GET_INFO_FFPROBE_SPAWN_ERROR = 'getInfo ffprobe spawn error:';
/** @const {string} Prefix when parsing getInfo JSON output fails. */
export const LOG_GET_INFO_JSON_PARSE_ERROR = 'getInfo JSON parse error:';
/** @const {string} Prefix when getMediaInfo is invoked. */
export const LOG_GET_MEDIA_INFO = 'getMediaInfo:';
/** @const {string} Prefix when getVideoPreview is invoked. */
export const LOG_GET_VIDEO_PREVIEW = 'getVideoPreview:';
/** @const {string} Prefix when media info is being fetched for a file. */
export const LOG_GETTING_MEDIA_INFO_FOR = 'Getting media info for:';
/** @const {string} Prefix when handleError is invoked. */
export const LOG_HANDLE_ERROR = 'handleError:';
/** @const {string} Prefix when handleErrorMessage is invoked. */
export const LOG_HANDLE_ERROR_MESSAGE = 'handleErrorMessage:';
/** @const {string} Prefix when logging hardware acceleration input options. */
export const LOG_HARDWARE_ACCELERATION_INPUT_OPTIONS = 'Hardware acceleration input options:';
/** @const {string} Prefix when logging a histogram value. */
export const LOG_HISTOGRAM = 'histogram:';
/** @const {string} Prefix when histogram decoding fails. */
export const LOG_HISTOGRAM_DECODE_FAILED = 'Histogram decode failed:';
/** @const {string} Prefix when histogram decoding fails with stderr output. */
export const LOG_HISTOGRAM_DECODE_FAILED_STDERR = 'Histogram decode failed, stderr:';
/** @const {string} Prefix when the histogram ffmpeg run errors. */
export const LOG_HISTOGRAM_FFMPEG_ERROR = 'Histogram ffmpeg error:';
/** @const {string} Prefix when image info has been retrieved. */
export const LOG_IMAGE_INFO_RETRIEVED = 'Image info retrieved:';
/** @const {string} Logged when '--info' is used without an input file. */
export const LOG_INFO_REQUIRES_AN_INPUT_FILE = '--info requires an input file';
/** @const {string} Logged when the CANCEL_CONVERSION IPC message is received. */
export const LOG_IPC_CANCEL_CONVERSION_CALLED = 'CANCEL_CONVERSION called';
/** @const {string} Prefix when the CONVERT_FILE IPC message is received. */
export const LOG_IPC_CONVERT_FILE = 'CONVERT_FILE:';
/** @const {string} Logged when the CONVERT_FILE IPC handler completes successfully. */
export const LOG_IPC_CONVERT_FILE_COMPLETED_SUCCESSFULLY = 'CONVERT_FILE completed successfully';
/** @const {string} Prefix when the CONVERT_FILE IPC handler fails. */
export const LOG_IPC_CONVERT_FILE_FAILED = 'CONVERT_FILE failed:';
/** @const {string} Prefix when the CONVERT_FILE IPC handler throws. */
export const LOG_IPC_CONVERT_FILE_THREW = 'CONVERT_FILE threw:';
/** @const {string} Prefix when the EXTRACT_THUMBNAILS IPC message is received. */
export const LOG_IPC_EXTRACT_THUMBNAILS = 'EXTRACT_THUMBNAILS:';
/** @const {string} Prefix when the EXTRACT_THUMBNAILS IPC handler fails. */
export const LOG_IPC_EXTRACT_THUMBNAILS_FAILED = 'EXTRACT_THUMBNAILS failed:';
/** @const {string} Prefix when the EXTRACT_WAVEFORM IPC message is received. */
export const LOG_IPC_EXTRACT_WAVEFORM = 'EXTRACT_WAVEFORM:';
/** @const {string} Prefix when the EXTRACT_WAVEFORM IPC handler fails. */
export const LOG_IPC_EXTRACT_WAVEFORM_FAILED = 'EXTRACT_WAVEFORM failed:';
/** @const {string} Logged when the GET_CAPABILITIES IPC message is received. */
export const LOG_IPC_GET_CAPABILITIES_CALLED = 'GET_CAPABILITIES called';
/** @const {string} Prefix when the GET_IMAGE_FILE_INFO IPC message is received. */
export const LOG_IPC_GET_IMAGE_FILE_INFO = 'GET_IMAGE_FILE_INFO:';
/** @const {string} Prefix when the GET_IMAGE_FILE_INFO IPC handler fails. */
export const LOG_IPC_GET_IMAGE_FILE_INFO_FAILED = 'GET_IMAGE_FILE_INFO failed:';
/** @const {string} Prefix when the GET_IMAGE_INFO IPC message is received. */
export const LOG_IPC_GET_IMAGE_INFO = 'GET_IMAGE_INFO:';
/** @const {string} Prefix when the GET_IMAGE_INFO IPC handler fails. */
export const LOG_IPC_GET_IMAGE_INFO_FAILED = 'GET_IMAGE_INFO failed:';
/** @const {string} Prefix when the GET_IMAGE_PREVIEW IPC message is received. */
export const LOG_IPC_GET_IMAGE_PREVIEW = 'GET_IMAGE_PREVIEW:';
/** @const {string} Prefix when the GET_IMAGE_PREVIEW IPC handler fails. */
export const LOG_IPC_GET_IMAGE_PREVIEW_FAILED = 'GET_IMAGE_PREVIEW failed:';
/** @const {string} Prefix when the GET_MEDIA_INFO IPC message is received. */
export const LOG_IPC_GET_MEDIA_INFO = 'GET_MEDIA_INFO:';
/** @const {string} Prefix when the GET_MEDIA_INFO IPC handler completes. */
export const LOG_IPC_GET_MEDIA_INFO_COMPLETED = 'GET_MEDIA_INFO completed:';
/** @const {string} Prefix when the GET_MEDIA_INFO IPC handler fails. */
export const LOG_IPC_GET_MEDIA_INFO_FAILED = 'GET_MEDIA_INFO failed:';
/** @const {string} Prefix when the GET_VIDEO_PREVIEW IPC message is received. */
export const LOG_IPC_GET_VIDEO_PREVIEW = 'GET_VIDEO_PREVIEW:';
/** @const {string} Prefix when the GET_VIDEO_PREVIEW IPC handler fails. */
export const LOG_IPC_GET_VIDEO_PREVIEW_FAILED = 'GET_VIDEO_PREVIEW failed:';
/** @const {string} Logged when the PAUSE_CONVERSION IPC message is received. */
export const LOG_IPC_PAUSE_CONVERSION_CALLED = 'PAUSE_CONVERSION called';
/** @const {string} Logged when the PLAYER_CLOSE IPC message is received. */
export const LOG_IPC_PLAYER_CLOSE = 'PLAYER_CLOSE';
/** @const {string} Prefix when the PLAYER_OPEN IPC message is received. */
export const LOG_IPC_PLAYER_OPEN = 'PLAYER_OPEN:';
/** @const {string} Prefix when PLAYER_OPEN fails and falls back to the default resolution. */
export const LOG_IPC_PLAYER_OPEN_FAILED_FALLING_BACK_TO_DEFAULT_RESOLUTION = 'PLAYER_OPEN failed, falling back to default resolution:';
/** @const {string} Prefix when the PLAYER_SEEK IPC message is received. */
export const LOG_IPC_PLAYER_SEEK = 'PLAYER_SEEK:';
/** @const {string} Prefix when the QUEUE_ADD IPC message is received. */
export const LOG_IPC_QUEUE_ADD = 'QUEUE_ADD:';
/** @const {string} Logged when the QUEUE_CANCEL_ALL IPC message is received. */
export const LOG_IPC_QUEUE_CANCEL_ALL_CALLED = 'QUEUE_CANCEL_ALL called';
/** @const {string} Logged when the QUEUE_CLEAR_COMPLETED IPC message is received. */
export const LOG_IPC_QUEUE_CLEAR_COMPLETED_CALLED = 'QUEUE_CLEAR_COMPLETED called';
/** @const {string} Logged when the QUEUE_EXPORT IPC message is received. */
export const LOG_IPC_QUEUE_EXPORT_CALLED = 'QUEUE_EXPORT called';
/** @const {string} Logged when the QUEUE_IMPORT IPC message is received. */
export const LOG_IPC_QUEUE_IMPORT_CALLED = 'QUEUE_IMPORT called';
/** @const {string} Prefix when the QUEUE_SET_CONCURRENCY IPC message is received. */
export const LOG_IPC_QUEUE_SET_CONCURRENCY = 'QUEUE_SET_CONCURRENCY:';
/** @const {string} Prefix when the QUEUE_MOVE_TO IPC message is received. */
export const LOG_IPC_QUEUE_MOVE_TO = 'QUEUE_MOVE_TO:';
/** @const {string} Logged when the QUEUE_PAUSE IPC message is received. */
export const LOG_IPC_QUEUE_PAUSE_CALLED = 'QUEUE_PAUSE called';
/** @const {string} Logged when the QUEUE_RESUME IPC message is received. */
export const LOG_IPC_QUEUE_RESUME_CALLED = 'QUEUE_RESUME called';
/** @const {string} Prefix when the QUEUE_LIST IPC message is received. */
export const LOG_IPC_QUEUE_LIST = 'QUEUE_LIST:';
/** @const {string} Logged when the QUEUE_GET_STATE IPC message is received. */
export const LOG_IPC_QUEUE_GET_STATE = 'QUEUE_GET_STATE called';
/** @const {string} Prefix when the QUEUE_REMOVE IPC message is received. */
export const LOG_IPC_QUEUE_REMOVE = 'QUEUE_REMOVE:';
/** @const {string} Prefix when the REVEAL_FILE IPC message is received. */
export const LOG_IPC_REVEAL_FILE = 'REVEAL_FILE:';
/** @const {string} Prefix when the SET_LAUNCH_AT_LOGIN IPC message is received. */
export const LOG_IPC_SET_LAUNCH_AT_LOGIN = 'SET_LAUNCH_AT_LOGIN:';
/** @const {string} Logged when the RESUME_CONVERSION IPC message is received. */
export const LOG_IPC_RESUME_CONVERSION_CALLED = 'RESUME_CONVERSION called';
/** @const {string} Logged when the SELECT_FILE IPC message is received. */
export const LOG_IPC_SELECT_FILE_CALLED = 'SELECT_FILE called';
/** @const {string} Prefix when logging the SELECT_FILE result. */
export const LOG_IPC_SELECT_FILE_RESULT = 'SELECT_FILE result:';
/** @const {string} Logged when the SELECT_FILES IPC message is received. */
export const LOG_IPC_SELECT_FILES_CALLED = 'SELECT_FILES called';
/** @const {string} Prefix when logging the SELECT_FILES result. */
export const LOG_IPC_SELECT_FILES_RESULT = 'SELECT_FILES result:';
/** @const {string} Logged when the SELECT_OUTPUT IPC message is received. */
export const LOG_IPC_SELECT_OUTPUT_CALLED = 'SELECT_OUTPUT called';
/** @const {string} Prefix when logging the SELECT_OUTPUT result. */
export const LOG_IPC_SELECT_OUTPUT_RESULT = 'SELECT_OUTPUT result:';
/** @const {string} Logged when the SELECT_DIRECTORY IPC message is received. */
export const LOG_IPC_SELECT_DIRECTORY_CALLED = 'SELECT_DIRECTORY called';
/** @const {string} Prefix when logging the SELECT_DIRECTORY result. */
export const LOG_IPC_SELECT_DIRECTORY_RESULT = 'SELECT_DIRECTORY result:';
/** @const {string} Logged when the WINDOW_CLOSE IPC message is received. */
export const LOG_IPC_WINDOW_CLOSE = 'WINDOW_CLOSE';
/** @const {string} Logged when the WINDOW_CONFIRM_CLOSE IPC message is received. */
export const LOG_IPC_WINDOW_CONFIRM_CLOSE = 'WINDOW_CONFIRM_CLOSE';
/** @const {string} Logged when the WINDOW_CLOSE_REQUESTED message is sent to the renderer. */
export const LOG_IPC_WINDOW_CLOSE_REQUESTED = 'WINDOW_CLOSE_REQUESTED';
/** @const {string} Logged when the WINDOW_MAXIMIZE_TOGGLE IPC message is received. */
export const LOG_IPC_WINDOW_MAXIMIZE_TOGGLE = 'WINDOW_MAXIMIZE_TOGGLE';
/** @const {string} Logged when the WINDOW_MINIMIZE IPC message is received. */
export const LOG_IPC_WINDOW_MINIMIZE = 'WINDOW_MINIMIZE';
/** @const {string} Logged when the WINDOW_SET_ALWAYS_ON_TOP IPC message is received. */
export const LOG_IPC_WINDOW_SET_ALWAYS_ON_TOP = 'WINDOW_SET_ALWAYS_ON_TOP';
/** @const {string} Prefix when a queue job completes. */
export const LOG_JOB_COMPLETED = 'Job completed:';
/** @const {string} Prefix when a queue job fails. */
export const LOG_JOB_FAILED = 'Job failed:';
/** @const {string} Prefix when a queue job throws while starting. */
export const LOG_JOB_THREW_ON_START = 'Job threw on start:';
/** @const {string} Prefix when loading the dev server URL. */
export const LOG_LOADING_DEV_SERVER_URL = 'Loading dev server URL:';
/** @const {string} Prefix when loading a video into the player. */
export const LOG_LOADING_PLAYER_FOR = 'Loading player for:';
/** @const {string} Logged when the production renderer is loaded. */
export const LOG_LOADING_PRODUCTION_RENDERER = 'Loading production renderer';
/** @const {string} Logged when the main window is closed. */
export const LOG_MAIN_WINDOW_CLOSED = 'Main window closed';
/** @const {string} Logged when the main window is ready and being shown. */
export const LOG_MAIN_WINDOW_READY_SHOWING = 'Main window ready, showing';
/** @const {string} Prefix when media info has been retrieved. */
export const LOG_MEDIA_INFO_RETRIEVED = 'Media info retrieved:';
/** @const {string} Logged when the React app is mounted. */
export const LOG_MOUNTING_REACT_APP = 'Mounting React app';
/** @const {string} Prefix warning that no frames were received for 3 seconds (decode may be stalled). */
export const LOG_NO_FRAMES_RECEIVED_FOR_3S_DECODE_MAY_BE_STALLED_GENERATION =
  'No frames received for 3s - decode may be stalled (generation';
/** @const {string} Logged when no input file has been selected. */
export const LOG_NO_INPUT_FILE_SELECTED = 'No input file selected';
/** @const {string} Prefix when a path is not a readable image file. */
export const LOG_NOT_A_READABLE_IMAGE_FILE = 'Not a readable image file:';
/** @const {string} Prefix when a path is not a readable video file. */
export const LOG_NOT_A_READABLE_VIDEO_FILE = 'Not a readable video file:';
/** @const {string} Prefix when a path cannot be used for thumbnail extraction. */
export const LOG_NOT_A_THUMBNAIL_ABLE_FILE = 'Not a thumbnail-able file:';
/** @const {string} Prefix when a path cannot be used for waveform extraction. */
export const LOG_NOT_A_WAVEFORM_ABLE_FILE = 'Not a waveform-able file:';
/** @const {string} Prefix when conversion progress is received. */
export const LOG_ON_CONVERSION_PROGRESS = 'onConversionProgress:';
/** @const {string} Prefix when a queue-added event is received. */
export const LOG_ON_QUEUE_ADDED = 'onQueueAdded:';
/** @const {string} Logged when a queue-cancelled event is received. */
export const LOG_ON_QUEUE_CANCELLED = 'onQueueCancelled';
/** @const {string} Prefix when a queue-moved event is received. */
export const LOG_ON_QUEUE_MOVED = 'onQueueMoved:';
/** @const {string} Prefix when a queue-removed event is received. */
export const LOG_ON_QUEUE_REMOVED = 'onQueueRemoved:';
/** @const {string} Prefix when a queue status-change event is received. */
export const LOG_ON_QUEUE_STATUS_CHANGE = 'onQueueStatusChange:';
/** @const {string} Prefix when a window-maximized-change event is received. */
export const LOG_ON_WINDOW_MAXIMIZED_CHANGE = 'onWindowMaximizedChange:';
/** @const {string} Prefix when opening a file. */
export const LOG_OPEN = 'open:';
/** @const {string} Prefix when opening a file dialog with the given accept filter. */
export const LOG_OPENING_FILE_DIALOG_ACCEPT = 'Opening file dialog, accept:';
/** @const {string} Prefix when logging an options value. */
export const LOG_OPTIONS = 'options:';
/** @const {string} Prefix when parsing CLI arguments. */
export const LOG_PARSING_CLI_ARGS = 'Parsing CLI args:';
/** @const {string} Logged when pauseConversion is invoked. */
export const LOG_PAUSE_CONVERSION_CALLED = 'pauseConversion called';
/** @const {string} Logged when an extraction is paused. */
export const LOG_PAUSE_EXTRACT = 'pauseExtract';
/** @const {string} Logged when the BMF process is being paused. */
export const LOG_PAUSING_BMF_PROCESS = 'Pausing BMF process';
/** @const {string} Logged when a cut job is being paused. */
export const LOG_PAUSING_CUT_JOB = 'Pausing cut job';
/** @const {string} Logged when the FFmpeg process is being paused. */
export const LOG_PAUSING_FFMPEG_PROCESS = 'Pausing FFmpeg process';
/** @const {string} Prefix when logging a pixel format value. */
export const LOG_PIXEL_FORMAT = 'Pixel format:';
/** @const {string} Logged when playerClose is invoked. */
export const LOG_PLAYER_CLOSE_CALLED = 'playerClose called';
/** @const {string} Prefix when the player encounters a decode error. */
export const LOG_PLAYER_DECODE_ERROR = 'Player decode error:';
/** @const {string} Prefix when the player decoder reports an error. */
export const LOG_PLAYER_DECODER_ERROR = 'Player decoder error:';
/** @const {string} Prefix when playerOpen is invoked. */
export const LOG_PLAYER_OPEN = 'playerOpen:';
/** @const {string} Prefix when playerSeek is invoked. */
export const LOG_PLAYER_SEEK = 'playerSeek:';
/** @const {string} Prefix when the preview cache is served from disk. */
export const LOG_PREVIEW_CACHE_HIT = 'preview cache hit:';
/** @const {string} Prefix when the preview cache misses and generates a preview. */
export const LOG_PREVIEW_CACHE_MISS = 'preview cache miss:';
/** @const {string} Prefix when a cached preview is rejected because the source file changed. */
export const LOG_PREVIEW_CACHE_STAT_MISMATCH = 'preview cache source changed:';
/** @const {string} Prefix when persisting a generated preview to disk fails. */
export const LOG_PREVIEW_CACHE_WRITE_FAILED = 'preview cache write failed:';
/** @const {string} Logged when processNext is called while already running. */
export const LOG_PROCESS_NEXT_ALREADY_RUNNING = 'processNext: already running';
/** @const {string} Logged when processNext finds no queued jobs. */
export const LOG_PROCESS_NEXT_NO_QUEUED_JOBS = 'processNext: no queued jobs';
/** @const {string} Logged when processNext starts a job. */
export const LOG_PROCESS_NEXT_STARTING_JOB = 'processNext: starting job';
/** @const {string} Prefix when a process has been resumed. */
export const LOG_PROCESS_RESUMED = 'Process resumed:';
/** @const {string} Prefix when a process has been suspended. */
export const LOG_PROCESS_SUSPENDED = 'Process suspended:';
/** @const {string} Prefix when logging a qscale value. */
export const LOG_QSCALE = 'Qscale:';
/** @const {string} Prefix when logging a quality value. */
export const LOG_QUALITY = 'quality:';
/** @const {string} Prefix when queueAdd is invoked. */
export const LOG_QUEUE_ADD = 'queueAdd:';
/** @const {string} Prefix when queueing an audio chunk fails. */
export const LOG_QUEUE_AUDIO_CHUNK_ERROR = 'queueAudioChunk error:';
/** @const {string} Logged when queueCancelAll is invoked. */
export const LOG_QUEUE_CANCEL_ALL_CALLED = 'queueCancelAll called';
/** @const {string} Logged when the queue is cancelled. */
export const LOG_QUEUE_CANCELLED = 'Queue cancelled';
/** @const {string} Prefix when completed jobs are cleared. */
export const LOG_QUEUE_CLEAR_COMPLETED = 'queueClearCompleted:';
/** @const {string} Prefix when the queue concurrency is set. */
export const LOG_QUEUE_SET_CONCURRENCY = 'setConcurrency:';
/** @const {string} Prefix when the queue is paused. */
export const LOG_QUEUE_PAUSE = 'pause:';
/** @const {string} Prefix when the queue is resumed. */
export const LOG_QUEUE_RESUME = 'resume:';
/** @const {string} Logged when queuePause is invoked. */
export const LOG_QUEUE_PAUSE_CALLED = 'queuePause called';
/** @const {string} Logged when queueResume is invoked. */
export const LOG_QUEUE_RESUME_CALLED = 'queueResume called';
/** @const {string} Prefix when a queued job is reordered. */
export const LOG_QUEUE_MOVE_TO = 'moveJobTo:';
/** @const {string} Logged when a move targets a job that is not queued. */
export const LOG_QUEUE_MOVE_SKIPPED = 'moveJobTo skipped: not queued:';
/** @const {string} Logged when a move target is clamped or unchanged. */
export const LOG_QUEUE_MOVE_TO_CLAMPED = 'moveJobTo clamped/unchanged:';
/** @const {string} Prefix when a queue job is added. */
export const LOG_QUEUE_JOB_ADDED = 'Queue job added:';
/** @const {string} Prefix when a queue job is removed. */
export const LOG_QUEUE_JOB_REMOVED = 'Queue job removed:';
/** @const {string} Prefix when a queue job status changes. */
export const LOG_QUEUE_JOB_STATUS_CHANGE = 'Queue job status change:';
/** @const {string} Prefix when queueExport is invoked. */
export const LOG_QUEUE_EXPORT = 'queueExport:';
/** @const {string} Prefix when queueImport is invoked. */
export const LOG_QUEUE_IMPORT = 'queueImport:';
/** @const {string} Prefix when the queue is exported to a file. */
export const LOG_QUEUE_EXPORTED = 'Exported queue:';
/** @const {string} Prefix when jobs are imported from a queue file. */
export const LOG_QUEUE_IMPORTED = 'Imported queue:';
/** @const {string} Logged when queueList is invoked. */
export const LOG_QUEUE_LIST_CALLED = 'queueList called';
/** @const {string} Logged when queueGetState is invoked. */
export const LOG_QUEUE_GET_STATE_CALLED = 'queueGetState called';
/** @const {string} Prefix when queueRemove is invoked. */
export const LOG_QUEUE_REMOVE = 'queueRemove:';
/** @const {string} Prefix when the persisted queue snapshot is restored. */
export const LOG_QUEUE_STATE_RESTORED = 'Restored queue state:';
/** @const {string} Prefix when the queue snapshot is saved to disk. */
export const LOG_QUEUE_STATE_SAVED = 'Saved queue state:';
/** @const {string} Logged when the persisted queue snapshot is cleared. */
export const LOG_QUEUE_STATE_CLEARED = 'Cleared queue state';
/** @const {string} Prefix when revealFile is invoked. */
export const LOG_REVEAL_FILE = 'revealFile:';
/** @const {string} Prefix when logging the queue size. */
export const LOG_QUEUE_SIZE = 'Queue size:';
/** @const {string} Logged when IPC handlers are being registered. */
export const LOG_REGISTERING_IPC_HANDLERS = 'Registering IPC handlers';
/** @const {string} Prefix when removeJob is invoked. */
export const LOG_REMOVE_JOB = 'removeJob:';
/** @const {string} Prefix when a partial output file is removed. */
export const LOG_REMOVED_PARTIAL_OUTPUT = 'Removed partial output:';
/** @const {string} Prefix when the player render loop errors. */
export const LOG_RENDER_LOOP_ERROR = 'renderLoop error:';
/** @const {string} Logged when a form is reset. */
export const LOG_RESET_FORM = 'resetForm';
/** @const {string} Prefix when logging a resolution value. */
export const LOG_RESOLUTION = 'resolution:';
/** @const {string} Logged when resumeConversion is invoked. */
export const LOG_RESUME_CONVERSION_CALLED = 'resumeConversion called';
/** @const {string} Logged when an extraction is resumed. */
export const LOG_RESUME_EXTRACT = 'resumeExtract';
/** @const {string} Logged when the BMF process is being resumed. */
export const LOG_RESUMING_BMF_PROCESS = 'Resuming BMF process';
/** @const {string} Logged when a cut job is being resumed. */
export const LOG_RESUMING_CUT_JOB = 'Resuming cut job';
/** @const {string} Logged when the FFmpeg process is being resumed. */
export const LOG_RESUMING_FFMPEG_PROCESS = 'Resuming FFmpeg process';
/** @const {string} Prefix when logging a scale value. */
export const LOG_SCALE = 'Scale:';
/** @const {string} Prefix when logging a keep-aspect-ratio scale value. */
export const LOG_SCALE_KEEP_ASPECT_RATIO = 'Scale (keep aspect ratio):';
/** @const {string} Prefix when scheduling one audio chunk fails. */
export const LOG_SCHEDULE_ONE_CHUNK_ERROR = 'scheduleOneChunk error:';
/** @const {string} Prefix when a seek is performed. */
export const LOG_SEEK = 'seek:';
/** @const {string} Logged when selectFile is invoked. */
export const LOG_SELECT_FILE_CALLED = 'selectFile called';
/** @const {string} Logged when selectFiles is invoked. */
export const LOG_SELECT_FILES_CALLED = 'selectFiles called';
/** @const {string} Prefix when selectInput is invoked. */
export const LOG_SELECT_INPUT = 'selectInput:';
/** @const {string} Prefix when selectInput fails. */
export const LOG_SELECT_INPUT_FAILED = 'selectInput failed:';
/** @const {string} Prefix when selectOutput is invoked. */
export const LOG_SELECT_OUTPUT = 'selectOutput:';
/** @const {string} Logged when selectOutput is invoked (renderer). */
export const LOG_SELECT_OUTPUT_CALLED = 'selectOutput called';
/** @const {string} Logged when selectDirectory is invoked (renderer). */
export const LOG_SELECT_DIRECTORY_CALLED = 'selectDirectory called';
/** @const {string} Prefix when selectOutput fails. */
export const LOG_SELECT_OUTPUT_FAILED = 'selectOutput failed:';
/** @const {string} Prefix when setAlwaysOnTop is invoked. */
export const LOG_SET_ALWAYS_ON_TOP = 'setAlwaysOnTop:';
/** @const {string} Prefix when setLaunchAtLogin is invoked. */
export const LOG_SET_LAUNCH_AT_LOGIN = 'setLaunchAtLogin:';
/** @const {string} Prefix when setQueueConcurrency is invoked. */
export const LOG_SET_QUEUE_CONCURRENCY = 'setQueueConcurrency:';
/** @const {string} Prefix when the audio bitrate is set. */
export const LOG_SET_AUDIO_BITRATE = 'setAudioBitrate:';
/** @const {string} Prefix when the audio codec is set. */
export const LOG_SET_AUDIO_CODEC = 'setAudioCodec:';
/** @const {string} Prefix when the audio streams are set. */
export const LOG_SET_AUDIO_STREAMS = 'setAudioStreams:';
/** @const {string} Prefix when the copy mode is set. */
export const LOG_SET_COPY_MODE = 'setCopyMode:';
/** @const {string} Prefix when the encoder type is set. */
export const LOG_SET_ENCODER_TYPE = 'setEncoderType:';
/** @const {string} Prefix when hardware acceleration is toggled. */
export const LOG_SET_HARDWARE_ACCELERATION = 'setHardwareAcceleration:';
/** @const {string} Prefix when the hardware acceleration mode is set. */
export const LOG_SET_HWACCEL_MODE = 'setHwaccelMode:';
/** @const {string} Prefix when the input is set. */
export const LOG_SET_INPUT = 'setInput:';
/** @const {string} Prefix when the input file is set. */
export const LOG_SET_INPUT_FILE = 'setInputFile:';
/** @const {string} Prefix when the include-audio toggle is set. */
export const LOG_SET_INCLUDE_AUDIO = 'setIncludeAudio:';
/** @const {string} Prefix when the converting state is set. */
export const LOG_SET_IS_CONVERTING = 'setIsConverting:';
/** @const {string} Prefix when a media task starts. */
export const LOG_MEDIA_TASK_STARTED = 'Media task started';
/** @const {string} Prefix when a media task finishes. */
export const LOG_MEDIA_TASK_FINISHED = 'Media task finished';
/** @const {string} Prefix when the paused state is set. */
export const LOG_SET_IS_PAUSED = 'setIsPaused:';
/** @const {string} Prefix when the job list is set. */
export const LOG_SET_JOBS = 'setJobs:';
/** @const {string} Prefix when the output is set. */
export const LOG_SET_OUTPUT = 'setOutput:';
/** @const {string} Prefix when the auto output is set. */
export const LOG_SET_OUTPUT_AUTO = 'setOutputAuto:';
/** @const {string} Prefix when the output file is set. */
export const LOG_SET_OUTPUT_FILE = 'setOutputFile:';
/** @const {string} Prefix when the start time is set. */
export const LOG_SET_START_TIME = 'setStartTime:';
/** @const {string} Prefix when the end time is set. */
export const LOG_SET_END_TIME = 'setEndTime:';
/** @const {string} Prefix when the duration is set. */
export const LOG_SET_DURATION = 'setDuration:';
/** @const {string} Prefix when the use-duration toggle is set. */
export const LOG_SET_USE_DURATION = 'setUseDuration:';
/** @const {string} Prefix when the video cut form is reset. */
export const LOG_RESET_VIDEO_CUT_FORM = 'resetVideoCutForm';
/** @const {string} Prefix when the pixel format is set. */
export const LOG_SET_PIXEL_FORMAT = 'setPixelFormat:';
/** @const {string} Prefix when the preview is set. */
export const LOG_SET_PREVIEW = 'setPreview:';
/** @const {string} Prefix when the qscale is set. */
export const LOG_SET_QSCALE = 'setQscale:';
/** @const {string} Prefix when the scale is set. */
export const LOG_SET_SCALE = 'setScale:';
/** @const {string} Prefix when the transcoder is set. */
export const LOG_SET_TRANSCODER = 'setTranscoder:';
/** @const {string} Prefix when the video bitrate is set. */
export const LOG_SET_VIDEO_BITRATE = 'setVideoBitrate:';
/** @const {string} Prefix when the video codec is set. */
export const LOG_SET_VIDEO_CODEC = 'setVideoCodec:';
/** @const {string} Logged when CLI help is shown. */
export const LOG_SHOWING_HELP = 'Showing help';
/** @const {string} Logged when the splash window is closed. */
export const LOG_SPLASH_WINDOW_CLOSED = 'Splash window closed';
/** @const {string} Prefix when a start action is logged. */
export const LOG_START = 'start:';
/** @const {string} Prefix when startConversion is invoked. */
export const LOG_START_CONVERSION = 'startConversion:';
/** @const {string} Logged when startConversion is called without an input file. */
export const LOG_START_CONVERSION_NO_INPUT_FILE = 'startConversion: no input file';
/** @const {string} Logged when startConversion is called without an output file. */
export const LOG_START_CONVERSION_NO_OUTPUT_FILE = 'startConversion: no output file';
/** @const {string} Prefix when startExtract is invoked. */
export const LOG_START_EXTRACT = 'startExtract:';
/** @const {string} Logged when startExtract is called without an input file. */
export const LOG_START_EXTRACT_NO_INPUT_FILE = 'startExtract: no input file';
/** @const {string} Logged when startExtract is called without an output file. */
export const LOG_START_EXTRACT_NO_OUTPUT_FILE = 'startExtract: no output file';
/** @const {string} Prefix when logging a start time value. */
export const LOG_START_TIME = 'Start time:';
/** @const {string} Prefix when a conversion is starting. */
export const LOG_STARTING_CONVERSION = 'Starting conversion:';
/** @const {string} Prefix when the app starts in CLI mode with the given argv. */
export const LOG_STARTING_IN_CLI_MODE_ARGV = 'Starting in CLI mode, argv:';
/** @const {string} Prefix when logging stderr output. */
export const LOG_STDERR = 'stderr:';
/** @const {string} Logged when subscribing to conversion progress events. */
export const LOG_SUBSCRIBING_TO_CONVERSION_PROGRESS = 'Subscribing to conversion progress';
/** @const {string} Prefix when switching the UI language. */
export const LOG_SWITCHING_LANGUAGE_TO = 'Switching language to:';
/** @const {string} Logged when thumbnail extraction fails because no frames were decoded. */
export const LOG_THUMBNAIL_EXTRACTION_FAILED_NO_FRAMES_DECODED = 'Thumbnail extraction failed: no frames decoded';
/** @const {string} Prefix when a thumbnail segment fails with a code. */
export const LOG_THUMBNAIL_SEGMENT_FAILED_WITH_CODE = 'Thumbnail segment failed with code:';
/** @const {string} Prefix when logging a transcoder value. */
export const LOG_TRANSCODER = 'transcoder:';
/** @const {string} Logged when unsubscribing from conversion progress events. */
export const LOG_UNSUBSCRIBING_FROM_CONVERSION_PROGRESS = 'Unsubscribing from conversion progress';
/** @const {string} Prefix when an image has an unsupported MIME type. */
export const LOG_UNSUPPORTED_IMAGE_MIME_TYPE = 'Unsupported image mime type:';
/** @const {string} Prefix when updateJob is invoked. */
export const LOG_UPDATE_JOB = 'updateJob:';
/** @const {string} Prefix when live per-job progress is updated. */
export const LOG_UPDATE_PROGRESS = 'updateProgress:';
/** @const {string} Prefix when a duration is being used. */
export const LOG_USE_DURATION = 'useDuration:';
/** @const {string} Logged when using stream copy mode. */
export const LOG_USING_STREAM_COPY_MODE = 'Using stream copy mode';
/** @const {string} Logged when validation fails. */
export const LOG_VALIDATION_FAILED = 'Validation failed';
/** @const {string} Logged when validation fails and a conversion is not started. */
export const LOG_VALIDATION_FAILED_NOT_STARTING_CONVERSION = 'Validation failed, not starting conversion';
/** @const {string} Prefix when logging a video bitrate value. */
export const LOG_VIDEO_BITRATE = 'Video bitrate:';
/** @const {string} Prefix when logging a video codec value. */
export const LOG_VIDEO_CODEC = 'Video codec:';
/** @const {string} Prefix when video preview extraction fails with stderr output. */
export const LOG_VIDEO_PREVIEW_EXTRACTION_FAILED_STDERR = 'Video preview extraction failed, stderr:';
/** @const {string} Prefix when the video preview ffmpeg run errors. */
export const LOG_VIDEO_PREVIEW_FFMPEG_ERROR = 'Video preview ffmpeg error:';
/** @const {string} Logged when waveform extraction fails because no audio was decoded. */
export const LOG_WAVEFORM_EXTRACTION_FAILED_NO_AUDIO_DECODED = 'Waveform extraction failed: no audio decoded';
/** @const {string} Prefix when a waveform segment fails with a code. */
export const LOG_WAVEFORM_SEGMENT_FAILED_WITH_CODE = 'Waveform segment failed with code:';
/** @const {string} Logged when Web Audio is unavailable and audio playback is disabled. */
export const LOG_WEB_AUDIO_IS_NOT_AVAILABLE_AUDIO_PLAYBACK_DISABLED = 'Web Audio is not available, audio playback disabled';
/** @const {string} Logged when windowClose is invoked. */
export const LOG_WINDOW_CLOSE_CALLED = 'windowClose called';
/** @const {string} Logged when windowCloseConfirmed is invoked. */
export const LOG_WINDOW_CONFIRM_CLOSE_CALLED = 'windowCloseConfirmed called';
/** @const {string} Logged when a window close request is received from the main process. */
export const LOG_ON_WINDOW_CLOSE_REQUESTED = 'onWindowCloseRequested';
/** @const {string} Logged when windowMaximizeToggle is invoked. */
export const LOG_WINDOW_MAXIMIZE_TOGGLE_CALLED = 'windowMaximizeToggle called';
/** @const {string} Logged when windowMinimize is invoked. */
export const LOG_WINDOW_MINIMIZE_CALLED = 'windowMinimize called';
/** @const {string} Logged when windowSetAlwaysOnTop is invoked. */
export const LOG_WINDOW_SET_ALWAYS_ON_TOP_CALLED = 'windowSetAlwaysOnTop called';
/** @const {string} Logged when setLaunchAtLogin is invoked. */
export const LOG_SET_LAUNCH_AT_LOGIN_CALLED = 'setLaunchAtLogin called';
/** @const {string} Logged when wrapAsync is invoked. */
export const LOG_WRAP_ASYNC_CALLED = 'wrapAsync called';
/** @const {string} Prefix when wrapAsync catches an error. */
export const LOG_WRAP_ASYNC_CAUGHT = 'wrapAsync caught:';
