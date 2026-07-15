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
