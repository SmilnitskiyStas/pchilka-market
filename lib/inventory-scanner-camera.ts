export const INVENTORY_SCANNER_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 20, max: 24 }
  },
  audio: false
};

export const INVENTORY_ZXING_SCAN_DELAY_MS = 900;
export const INVENTORY_SCANNER_TIMEOUT_MS = 45_000;

const INVENTORY_SCANNER_RELAXED_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' }
  },
  audio: false
};

function isRetryableCameraStartError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'NotReadableError' ||
    error.name === 'AbortError' ||
    error.name === 'OverconstrainedError' ||
    /could not start video source|track start|starting video failed/i.test(error.message)
  );
}

export async function openInventoryScannerCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('CAMERA_NOT_SUPPORTED');
  }

  const attempts = [INVENTORY_SCANNER_MEDIA_CONSTRAINTS, INVENTORY_SCANNER_RELAXED_MEDIA_CONSTRAINTS];
  let lastError: unknown = null;

  for (let index = 0; index < attempts.length; index += 1) {
    try {
      return await navigator.mediaDevices.getUserMedia(attempts[index]);
    } catch (error) {
      lastError = error;
      if (!isRetryableCameraStartError(error) || index === attempts.length - 1) break;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
    }
  }

  throw lastError;
}

export function getInventoryScannerCameraErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';

  if (message === 'CAMERA_NOT_SUPPORTED') {
    return 'Цей браузер не підтримує доступ до камери. Відкрийте посилання у Chrome або Safari.';
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Доступ до камери заборонено. Дозвольте камеру для Telegram або браузера в налаштуваннях телефону та спробуйте ще раз.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Камеру на телефоні не знайдено. Перевірте налаштування пристрою або відкрийте форму в іншому браузері.';
  }
  if (
    name === 'NotReadableError' ||
    name === 'AbortError' ||
    /could not start video source|track start|starting video failed/i.test(message)
  ) {
    return 'Не вдалося запустити камеру. Закрийте Камеру та інші застосунки, які можуть її використовувати, поверніться в Telegram і натисніть «Сканувати штрихкод» ще раз.';
  }
  return 'Не вдалося відкрити камеру для сканування. Перезапустіть Telegram або відкрийте форму в Chrome та спробуйте ще раз.';
}
