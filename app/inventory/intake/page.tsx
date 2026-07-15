'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  getSuspiciousInventoryExpiryDate,
  type SuspiciousInventoryExpiryDate
} from '@/lib/inventory-expiry-date-rules';
import { normalizeInventoryBarcode, type InventoryProductInput } from '@/lib/inventory-product-types';
import {
  getInventoryScannerCameraErrorMessage,
  INVENTORY_SCANNER_TIMEOUT_MS,
  INVENTORY_ZXING_SCAN_DELAY_MS,
  openInventoryScannerCamera
} from '@/lib/inventory-scanner-camera';

type ProductView = {
  id: string;
  article: string;
  barcode: string;
  barcodes?: string[];
  barcodeEntries?: Array<{
    barcode: string;
    unitsOfMeasurement: string;
  }>;
  productName: string;
  unitsOfMeasurement: string;
  category: string;
  notifiedDaysDefault: number;
  isActive: boolean;
};

type StoreView = {
  id: string;
  storeCode: string;
  city: string;
  addressLine: string;
};

type IntakeContextPayload = {
  ok?: boolean;
  user?: {
    id: number;
    name: string;
    surname: string;
    positionTitle?: string;
    role: string;
    storeId: string;
    storeLabel: string;
  };
  store?: StoreView;
  products?: ProductView[];
  lastBatchCode?: string;
  nextBatchCode?: string;
  openBatchCodes?: OpenBatchCodeView[];
  error?: string;
};

type OpenBatchCodeView = {
  batchCode: string;
  itemCount: number;
  totalQuantity: number;
  latestCreatedAt: string;
};

type BatchPayload = {
  ok?: boolean;
  batch?: {
    id: string;
    productName: string;
    batchCode?: string;
    quantity: number;
    expiryDate: string;
  };
  duplicateBatch?: {
    id: string;
    productName: string;
    storeLabel: string;
    expiryDate: string;
    quantity: number;
    batchCode: string;
  };
  suspiciousExpiryDate?: SuspiciousInventoryExpiryDate;
  resolution?: 'created' | 'merged';
  error?: string;
};

type ProductPayload = {
  ok?: boolean;
  product?: ProductView;
  error?: string;
};

type ProductLookupPayload = {
  ok?: boolean;
  product?: ProductView | null;
  products?: ProductView[];
  error?: string;
};

type DetectedBarcode = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

type ZxingControls = {
  stop: () => void;
};

type ScannerDebugActionType =
  | 'inventory_scanner_start_requested'
  | 'inventory_scanner_stream_ready'
  | 'inventory_scanner_video_ready'
  | 'inventory_scanner_detector_error'
  | 'inventory_scanner_barcode_detected'
  | 'inventory_scanner_no_barcode_detected'
  | 'inventory_scanner_camera_error';

type BarcodeLookupStatus = 'idle' | 'found' | 'not_found';
type BatchSelectionMode = 'existing' | 'new';

type DateInputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorInstance;
  }
}

const initialNewProductForm: InventoryProductInput = {
  article: '',
  barcode: '',
  productName: '',
  unitsOfMeasurement: '',
  category: '',
  notifiedDaysDefault: 7,
  isActive: true
};

function formatProductBarcodes(barcodes?: string[], fallback = '') {
  const normalized = Array.isArray(barcodes) ? barcodes.filter(Boolean) : [];
  if (normalized.length > 0) return normalized.join(', ');
  return fallback || '—';
}

function getProductMatchByBarcode(products: ProductView[], barcode: string) {
  const normalized = normalizeInventoryBarcode(barcode);
  if (!normalized) return null;

  for (const product of products) {
    const barcodeEntry = product.barcodeEntries?.find(
      (item) => normalizeInventoryBarcode(item.barcode) === normalized
    );
    if (barcodeEntry) {
      return {
        ...product,
        unitsOfMeasurement: barcodeEntry.unitsOfMeasurement || product.unitsOfMeasurement
      };
    }

    const hasBarcode = (product.barcodes?.length ? product.barcodes : [product.barcode]).some(
      (item) => normalizeInventoryBarcode(item) === normalized
    );
    if (hasBarcode) {
      return product;
    }
  }

  return null;
}

function formatDateForInput(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
}

function normalizeDateForApi(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const localMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (localMatch) {
    const day = localMatch[1].padStart(2, '0');
    const month = localMatch[2].padStart(2, '0');
    const year = localMatch[3];
    return `${year}-${month}-${day}`;
  }

  return '';
}

function formatDateForCalendar(value: string) {
  return normalizeDateForApi(value);
}

function normalizeDateTextInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return formatDateForInput(trimmed);
  }

  const digits = trimmed.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  return [day, month, year].filter(Boolean).join('.');
}

function isLikelyBarcode(value: string) {
  return /^\d{6,14}$/.test(normalizeInventoryBarcode(value));
}

function incrementBatchCode(value: string) {
  const match = value.match(/^(.*-)(\d+)$/);
  if (!match) return value;

  const next = Number(match[2]) + 1;
  if (!Number.isFinite(next)) return value;

  return `${match[1]}${String(next).padStart(match[2].length, '0')}`;
}

function DateInputField({ label, value, onChange, placeholder, hint }: DateInputFieldProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-900">{label}</label>
      <div className="relative mt-1.5">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(normalizeDateTextInput(event.target.value))}
          placeholder={placeholder ?? 'дд.мм.рррр'}
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          className="w-full rounded-xl border border-slate-300 py-3 pl-3 pr-12 text-sm outline-none focus:border-brand"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18" />
            <rect x="3" y="4" width="18" height="18" rx="3" />
          </svg>
        </span>
        <input
          type="date"
          value={formatDateForCalendar(value)}
          onChange={(event) => onChange(event.target.value ? formatDateForInput(event.target.value) : '')}
          aria-label={`Відкрити календар: ${label}`}
          className="absolute right-0 top-0 h-full w-12 cursor-pointer opacity-0"
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {hint ?? 'Можна вводити дату цифрами без крапок, формат підставиться автоматично.'}
      </p>
    </div>
  );
}

export default function InventoryIntakePage() {
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('staff');
  const [storeLabel, setStoreLabel] = useState('');
  const [products, setProducts] = useState<ProductView[]>([]);
  const [productSearchResults, setProductSearchResults] = useState<ProductView[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [productId, setProductId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [batchSelectionMode, setBatchSelectionMode] = useState<BatchSelectionMode>('new');
  const [lastBatchCode, setLastBatchCode] = useState('');
  const [nextBatchCode, setNextBatchCode] = useState('');
  const [openBatchCodes, setOpenBatchCodes] = useState<OpenBatchCodeView[]>([]);
  const [quantity, setQuantity] = useState('1');
  const [unitsOfMeasurement, setUnitsOfMeasurement] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => formatDateForInput(new Date()));
  const [notifiedDays, setNotifiedDays] = useState('');
  const [newProductForm, setNewProductForm] = useState<InventoryProductInput>(initialNewProductForm);
  const [newProductNote, setNewProductNote] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isStartingScanner, setIsStartingScanner] = useState(false);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const [barcodeLookupStatus, setBarcodeLookupStatus] = useState<BarcodeLookupStatus>('idle');
  const [barcodeLookupMessage, setBarcodeLookupMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [success, setSuccess] = useState('');
  const [duplicateBatch, setDuplicateBatch] = useState<NonNullable<BatchPayload['duplicateBatch']> | null>(null);
  const [suspiciousExpiryDateWarning, setSuspiciousExpiryDateWarning] = useState<SuspiciousInventoryExpiryDate | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const productsRef = useRef<ProductView[]>([]);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scannerTimeoutRef = useRef<number | null>(null);
  const scannerDiagnosticTimerRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<ZxingControls | null>(null);
  const zxingReaderRef = useRef<{ reset?: () => void } | null>(null);
  const scannerEngineRef = useRef<'barcode-detector' | 'zxing' | null>(null);
  const isStartingScannerRef = useRef(false);
  const isDetectingBarcodeRef = useRef(false);
  const isHandlingBarcodeRef = useRef(false);
  const scannerSessionIdRef = useRef('');
  const scannerStartedAtRef = useRef(0);
  const scannerDetectionAttemptsRef = useRef(0);
  const scannerDetectorErrorLoggedRef = useRef(false);
  productsRef.current = products;

  function logScannerDebug(
    actionType: ScannerDebugActionType,
    meta: Record<string, string | number | boolean | null | undefined> = {}
  ) {
    if (!token) return;

    const elapsedMs = scannerStartedAtRef.current > 0 ? Date.now() - scannerStartedAtRef.current : 0;
    const body = {
      token,
      actionType,
      meta: {
        ...meta,
        sessionId: scannerSessionIdRef.current,
        elapsedMs,
        detectionAttempts: scannerDetectionAttemptsRef.current,
        visibilityState: document.visibilityState,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      }
    };

    void fetch('/api/inventory/scanner-debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(() => {
      // Scanner logging must never block or interrupt the worker flow.
    });
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenFromUrl = url.searchParams.get('token') ?? '';
    setToken(tokenFromUrl);

    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/inventory/intake/context?token=${encodeURIComponent(tokenFromUrl)}`, {
          cache: 'no-store'
        });
        const payload = (await response.json()) as IntakeContextPayload;
        if (!response.ok || !payload.ok || !payload.user || !payload.store || !Array.isArray(payload.products)) {
          throw new Error(payload.error || 'Не вдалося підготувати форму внесення партії.');
        }

        setUserName(`${payload.user.surname} ${payload.user.name}`.trim());
        setUserRole(payload.user.role);
        setStoreLabel([payload.store.storeCode, payload.store.city, payload.store.addressLine].filter(Boolean).join(' | '));
        setProducts(payload.products);
        setLastBatchCode(String(payload.lastBatchCode ?? '').trim());
        setNextBatchCode(String(payload.nextBatchCode ?? '').trim());
        const availableBatchCodes = Array.isArray(payload.openBatchCodes) ? payload.openBatchCodes : [];
        setOpenBatchCodes(availableBatchCodes);
        if (availableBatchCodes[0]?.batchCode) {
          setBatchCode(availableBatchCodes[0].batchCode);
          setBatchSelectionMode('existing');
        } else {
          setBatchCode('');
          setBatchSelectionMode('new');
        }
        setLoadError('');
      } catch (loadError) {
        setLoadError(loadError instanceof Error ? loadError.message : 'Не вдалося підготувати форму внесення партії.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      stopScanner();
    };
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        const wasScannerActive = scannerEngineRef.current !== null || streamRef.current !== null || zxingControlsRef.current !== null;
        stopScanner();
        if (wasScannerActive) {
          setScannerMessage('Камеру закрито після згортання застосунку. За потреби відкрийте сканер знову.');
        }
      }
    }

    function handlePageHide() {
      stopScanner();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  useEffect(() => {
    if (!isScannerOpen) return;

    scannerDiagnosticTimerRef.current = window.setTimeout(() => {
      logScannerDebug('inventory_scanner_no_barcode_detected', {
        stage: 'still_scanning_after_10_seconds',
        engine: scannerEngineRef.current ?? 'unknown',
        videoWidth: videoRef.current?.videoWidth ?? 0,
        videoHeight: videoRef.current?.videoHeight ?? 0,
        videoReadyState: videoRef.current?.readyState ?? 0
      });
    }, 10_000);

    scannerTimeoutRef.current = window.setTimeout(() => {
      logScannerDebug('inventory_scanner_no_barcode_detected', {
        stage: 'scanner_timeout',
        engine: scannerEngineRef.current ?? 'unknown',
        videoWidth: videoRef.current?.videoWidth ?? 0,
        videoHeight: videoRef.current?.videoHeight ?? 0,
        videoReadyState: videoRef.current?.readyState ?? 0
      });
      stopScanner();
      setScannerMessage(
        `Сканер автоматично закрито після ${INVENTORY_SCANNER_TIMEOUT_MS / 1000} секунд без зчитування. Натисніть «Сканувати штрихкод», щоб спробувати знову.`
      );
    }, INVENTORY_SCANNER_TIMEOUT_MS);

    return () => {
      if (scannerDiagnosticTimerRef.current != null) {
        window.clearTimeout(scannerDiagnosticTimerRef.current);
        scannerDiagnosticTimerRef.current = null;
      }
      if (scannerTimeoutRef.current != null) {
        window.clearTimeout(scannerTimeoutRef.current);
        scannerTimeoutRef.current = null;
      }
    };
  }, [isScannerOpen]);

  useEffect(() => {
    if (!isScannerOpen || !streamRef.current || !videoRef.current || !detectorRef.current) return;
    if (scannerEngineRef.current !== 'barcode-detector') return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    let cancelled = false;

    async function attachAndScan() {
      try {
        await video.play();
        const track = streamRef.current?.getVideoTracks()[0];
        const settings = track?.getSettings();
        logScannerDebug('inventory_scanner_video_ready', {
          engine: 'barcode-detector',
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          videoReadyState: video.readyState,
          trackReadyState: track?.readyState ?? 'missing',
          trackMuted: track?.muted ?? false,
          streamWidth: settings?.width ?? 0,
          streamHeight: settings?.height ?? 0,
          frameRate: settings?.frameRate ?? 0,
          facingMode: settings?.facingMode ?? ''
        });
      } catch (error) {
        logScannerDebug('inventory_scanner_detector_error', {
          stage: 'video_play',
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        return;
      }

      if (cancelled) return;

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || !detectorRef.current || isDetectingBarcodeRef.current || isHandlingBarcodeRef.current) return;

        isDetectingBarcodeRef.current = true;
        scannerDetectionAttemptsRef.current += 1;
        try {
          const detected = await detectorRef.current.detect(videoRef.current);
          const first = detected.find((item) => item.rawValue?.trim());
          if (first?.rawValue) {
            await handleDetectedBarcode(first.rawValue);
          }
        } catch (error) {
          if (!scannerDetectorErrorLoggedRef.current) {
            scannerDetectorErrorLoggedRef.current = true;
            logScannerDebug('inventory_scanner_detector_error', {
              stage: 'barcode_detector_detect',
              errorName: error instanceof Error ? error.name : 'UnknownError',
              errorMessage: error instanceof Error ? error.message : String(error)
            });
          }
        } finally {
          isDetectingBarcodeRef.current = false;
        }
      }, 600);
    }

    void attachAndScan();

    return () => {
      cancelled = true;
      if (scanTimerRef.current != null) {
        window.clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [isScannerOpen]);

  useEffect(() => {
    if (!isScannerOpen || !videoRef.current || !streamRef.current) return;
    if (scannerEngineRef.current !== 'zxing') return;
    if (zxingControlsRef.current) return;

    let cancelled = false;

    async function attachAndScanWithZxing() {
      try {
        const { BarcodeFormat, BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled || !videoRef.current || !streamRef.current) return;
        const stream = streamRef.current;

        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: INVENTORY_ZXING_SCAN_DELAY_MS,
          delayBetweenScanSuccess: INVENTORY_ZXING_SCAN_DELAY_MS
        });
        reader.possibleFormats = [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39
        ];
        zxingReaderRef.current = reader as { reset?: () => void };
        const controls = await reader.decodeFromStream(stream, videoRef.current, (result, error) => {
          scannerDetectionAttemptsRef.current += 1;
          if (result) {
            void handleDetectedBarcode(result.getText());
          } else if (error && error.name !== 'NotFoundException' && !scannerDetectorErrorLoggedRef.current) {
            scannerDetectorErrorLoggedRef.current = true;
            logScannerDebug('inventory_scanner_detector_error', {
              stage: 'zxing_decode',
              errorName: error.name || 'UnknownError',
              errorMessage: error.message || String(error)
            });
          }
        });

        if (cancelled) {
          controls.stop();
          (reader as { reset?: () => void }).reset?.();
          return;
        }

        zxingControlsRef.current = controls as ZxingControls;
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings();
        logScannerDebug('inventory_scanner_video_ready', {
          engine: 'zxing',
          videoWidth: videoRef.current?.videoWidth ?? 0,
          videoHeight: videoRef.current?.videoHeight ?? 0,
          videoReadyState: videoRef.current?.readyState ?? 0,
          trackReadyState: track?.readyState ?? 'missing',
          trackMuted: track?.muted ?? false,
          streamWidth: settings?.width ?? 0,
          streamHeight: settings?.height ?? 0,
          frameRate: settings?.frameRate ?? 0,
          facingMode: settings?.facingMode ?? ''
        });
      } catch (error) {
        if (!cancelled) {
          logScannerDebug('inventory_scanner_detector_error', {
            stage: 'zxing_start',
            errorName: error instanceof Error ? error.name : 'UnknownError',
            errorMessage: error instanceof Error ? error.message : String(error)
          });
          stopScanner();
          setMessageError(error instanceof Error ? error.message : 'Не вдалося відкрити камеру для сканування.');
        }
      }
    }

    void attachAndScanWithZxing();

    return () => {
      cancelled = true;
    };
  }, [isScannerOpen]);

  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return products;

    const source =
      !isLikelyBarcode(productFilter) && productSearchResults.length > 0
        ? productSearchResults
        : products;

    return source.filter((item) => {
      const searchable = [
        item.productName,
        item.article,
        item.barcode,
        item.category,
        ...(item.barcodes ?? []),
        ...(item.barcodeEntries?.map((entry) => entry.barcode) ?? [])
      ];

      return searchable.some((value) => String(value ?? '').toLowerCase().includes(q));
    });
  }, [productFilter, productSearchResults, products]);

  const trimmedBatchCode = batchCode.trim();
  const selectedOpenBatch = useMemo(
    () => openBatchCodes.find((item) => item.batchCode === trimmedBatchCode) ?? null,
    [openBatchCodes, trimmedBatchCode]
  );
  const selectedProduct = useMemo(() => products.find((item) => item.id === productId) ?? null, [productId, products]);
  const productSearchInputClass = [
    'mt-1.5 w-full rounded-xl border p-3 text-sm outline-none transition',
    barcodeLookupStatus === 'found'
      ? 'border-emerald-500 bg-emerald-50 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
      : barcodeLookupStatus === 'not_found'
        ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-2 focus:ring-red-100'
        : 'border-slate-300 focus:border-brand'
  ].join(' ');

  useEffect(() => {
    setUnitsOfMeasurement(selectedProduct?.unitsOfMeasurement ?? '');
  }, [selectedProduct?.id, selectedProduct?.unitsOfMeasurement]);

  useEffect(() => {
    if (openBatchCodes.length === 0) {
      if (batchSelectionMode !== 'new') {
        setBatchSelectionMode('new');
      }
      if (trimmedBatchCode) {
        setBatchCode('');
      }
      return;
    }

    if (trimmedBatchCode && selectedOpenBatch) {
      return;
    }

    const fallbackBatchCode = String(openBatchCodes[0]?.batchCode ?? '').trim();
    if (!fallbackBatchCode) {
      setBatchCode('');
      setBatchSelectionMode('new');
      return;
    }

    if (batchSelectionMode === 'new' && trimmedBatchCode && !selectedOpenBatch) {
      setBatchCode('');
      return;
    }

    if (batchSelectionMode === 'existing' || !trimmedBatchCode) {
      setBatchCode(fallbackBatchCode);
      setBatchSelectionMode('existing');
    }
  }, [batchSelectionMode, openBatchCodes, selectedOpenBatch, trimmedBatchCode]);

  useEffect(() => {
    const normalized = normalizeInventoryBarcode(productFilter);
    if (!normalized) {
      setBarcodeLookupStatus('idle');
      setBarcodeLookupMessage('');
      return;
    }

    const exactBarcodeMatch = getProductMatchByBarcode(products, normalized);
    if (exactBarcodeMatch) {
      setProductId((current) => (current === exactBarcodeMatch.id ? current : exactBarcodeMatch.id));
      setBarcodeLookupStatus('found');
      setBarcodeLookupMessage(`Товар знайдено: ${exactBarcodeMatch.productName}`);
      setNewProductForm((prev) => ({
        ...prev,
        barcode: exactBarcodeMatch.barcode || prev.barcode,
        productName: exactBarcodeMatch.productName || prev.productName
      }));
      setIsAddingProduct(false);
    }
  }, [productFilter, products]);

  useEffect(() => {
    const barcode = normalizeInventoryBarcode(productFilter);
    if (!token || !barcode || !isLikelyBarcode(productFilter) || isHandlingBarcodeRef.current) {
      return;
    }

    const localMatch = getProductMatchByBarcode(products, barcode);
    if (localMatch) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const exactBarcodeMatch = await lookupProductByBarcode(barcode, controller.signal);
        if (cancelled) return;

        if (exactBarcodeMatch) {
          setProductId(exactBarcodeMatch.id);
          setBarcodeLookupStatus('found');
          setBarcodeLookupMessage(`Товар знайдено: ${exactBarcodeMatch.productName}`);
          setIsAddingProduct(false);
        } else {
          setBarcodeLookupStatus('not_found');
          setBarcodeLookupMessage(`Штрихкод ${barcode} не знайдено в базі.`);
        }
      } catch (error) {
        if (!cancelled) {
          setBarcodeLookupStatus('not_found');
          setBarcodeLookupMessage(`Не вдалося знайти товар за штрихкодом ${barcode}.`);
          setMessageError(error instanceof Error ? error.message : 'Не вдалося знайти товар за штрихкодом.');
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [productFilter, token, products]);

  function handleProductFilterChange(value: string) {
    setProductFilter(value);
    if (!value.trim()) {
      setProductSearchResults([]);
    }

    if (!isLikelyBarcode(value)) {
      setBarcodeLookupStatus('idle');
      setBarcodeLookupMessage('');
    }
  }

  useEffect(() => {
    const query = productFilter.trim();
    if (!token || !query || isLikelyBarcode(query) || query.length < 2) {
      setIsSearchingProducts(false);
      if (!query || query.length < 2 || isLikelyBarcode(query)) {
        setProductSearchResults([]);
      }
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingProducts(true);
      try {
        const response = await fetch(
          `/api/inventory/intake/product-lookup?token=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}`,
          { cache: 'no-store', signal: controller.signal }
        );
        const payload = (await response.json()) as ProductLookupPayload;
        if (!response.ok || !payload.ok || !Array.isArray(payload.products)) {
          throw new Error(payload.error || 'Не вдалося знайти товар за назвою або артикулом.');
        }

        if (cancelled) return;

        setProductSearchResults(payload.products);
        setProducts((prev) => {
          const merged = new Map<string, ProductView>();
          for (const item of prev) merged.set(item.id, item);
          for (const item of payload.products ?? []) merged.set(item.id, item);
          return Array.from(merged.values()).sort((a, b) => a.productName.localeCompare(b.productName, 'uk'));
        });
      } catch (error) {
        if (!cancelled) {
          setProductSearchResults([]);
          setMessageError(error instanceof Error ? error.message : 'Не вдалося знайти товар за назвою або артикулом.');
        }
      } finally {
        if (!cancelled) {
          setIsSearchingProducts(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [productFilter, token]);

  function resetMessages() {
    setMessageError('');
    setSuccess('');
  }

  async function lookupProductByBarcode(barcode: string, signal?: AbortSignal) {
    const normalizedBarcode = normalizeInventoryBarcode(barcode);
    if (!normalizedBarcode || !token) return null;

    const localMatch = getProductMatchByBarcode(productsRef.current, normalizedBarcode);
    if (localMatch) return localMatch;

    const response = await fetch(
      `/api/inventory/intake/product-lookup?token=${encodeURIComponent(token)}&barcode=${encodeURIComponent(normalizedBarcode)}`,
      { cache: 'no-store', signal }
    );
    const payload = (await response.json()) as ProductLookupPayload;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Не вдалося знайти товар за штрихкодом.');
    }

    if (payload.product) {
      setProducts((prev) => {
        const next = prev.filter((item) => item.id !== payload.product?.id);
        return [payload.product as ProductView, ...next].sort((a, b) => a.productName.localeCompare(b.productName, 'uk'));
      });
    }

    return payload.product ?? null;
  }

  function stopScanner() {
    if (scannerDiagnosticTimerRef.current != null) {
      window.clearTimeout(scannerDiagnosticTimerRef.current);
      scannerDiagnosticTimerRef.current = null;
    }
    if (scannerTimeoutRef.current != null) {
      window.clearTimeout(scannerTimeoutRef.current);
      scannerTimeoutRef.current = null;
    }

    if (scanTimerRef.current != null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    detectorRef.current = null;
    scannerEngineRef.current = null;

    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }
    if (zxingReaderRef.current?.reset) {
      zxingReaderRef.current.reset();
      zxingReaderRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setIsScannerOpen(false);
  }

  async function handleDetectedBarcode(rawValue: string) {
    const barcode = normalizeInventoryBarcode(rawValue);
    if (!barcode || isHandlingBarcodeRef.current) return;

    isHandlingBarcodeRef.current = true;
    logScannerDebug('inventory_scanner_barcode_detected', {
      engine: scannerEngineRef.current ?? 'unknown',
      barcode,
      barcodeLength: barcode.length
    });
    stopScanner();

    setProductFilter(barcode);
    setScannerMessage(`Знайдено штрихкод: ${barcode}`);
    setNewProductForm((prev) => ({
      ...prev,
      barcode,
      article: prev.article || barcode
    }));

    try {
      const exactBarcodeMatch = await lookupProductByBarcode(barcode);
      if (exactBarcodeMatch) {
        setProductId(exactBarcodeMatch.id);
        setBarcodeLookupStatus('found');
        setBarcodeLookupMessage(`Товар знайдено: ${exactBarcodeMatch.productName}`);
        setSuccess(`Товар "${exactBarcodeMatch.productName}" знайдено за штрихкодом ${barcode}.`);
        setMessageError('');
        setIsAddingProduct(false);
      } else {
        setBarcodeLookupStatus('not_found');
        setBarcodeLookupMessage(`Штрихкод ${barcode} не знайдено в базі.`);
        setSuccess('');
        setMessageError(`Штрихкод ${barcode} не знайдено в базі. Нижче можна створити новий товар.`);
        setIsAddingProduct(true);
      }
    } catch (error) {
      setBarcodeLookupStatus('not_found');
      setBarcodeLookupMessage('Не вдалося перевірити штрихкод.');
      setSuccess('');
      setMessageError(error instanceof Error ? error.message : 'Не вдалося знайти товар за штрихкодом.');
    } finally {
      isHandlingBarcodeRef.current = false;
    }
  }

  async function startScanner() {
    if (isStartingScannerRef.current) return;
    isStartingScannerRef.current = true;
    setIsStartingScanner(true);
    scannerSessionIdRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    scannerStartedAtRef.current = Date.now();
    scannerDetectionAttemptsRef.current = 0;
    scannerDetectorErrorLoggedRef.current = false;
    isDetectingBarcodeRef.current = false;
    isHandlingBarcodeRef.current = false;
    setScannerMessage('');
    setBarcodeLookupStatus('idle');
    setBarcodeLookupMessage('');
    resetMessages();
    logScannerDebug('inventory_scanner_start_requested', {
      secureContext: window.isSecureContext,
      hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
      hasBarcodeDetector: Boolean(window.BarcodeDetector)
    });

    if (!window.isSecureContext) {
      logScannerDebug('inventory_scanner_camera_error', { stage: 'insecure_context' });
      setMessageError('Сканування камерою працює лише через HTTPS або на localhost.');
      isStartingScannerRef.current = false;
      setIsStartingScanner(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      logScannerDebug('inventory_scanner_camera_error', { stage: 'media_devices_unavailable' });
      setMessageError('Браузер не підтримує доступ до камери.');
      isStartingScannerRef.current = false;
      setIsStartingScanner(false);
      return;
    }

    try {
      stopScanner();
      setScannerMessage('Відкриваємо камеру...');
      const stream = await openInventoryScannerCamera();

      if (document.visibilityState === 'hidden') {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        setScannerMessage('Камеру не відкрито, тому що застосунок було згорнуто. Поверніться та запустіть сканер знову.');
        return;
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings();
      logScannerDebug('inventory_scanner_stream_ready', {
        engine: window.BarcodeDetector ? 'barcode-detector' : 'zxing',
        trackReadyState: track?.readyState ?? 'missing',
        trackMuted: track?.muted ?? false,
        streamWidth: settings?.width ?? 0,
        streamHeight: settings?.height ?? 0,
        frameRate: settings?.frameRate ?? 0,
        facingMode: settings?.facingMode ?? ''
      });
      if (!window.BarcodeDetector) {
        scannerEngineRef.current = 'zxing';
        setIsScannerOpen(true);
        setScannerMessage('Камеру відкрито. Наведіть її на штрихкод товару.');
        return;
      }

      detectorRef.current = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
      });
      scannerEngineRef.current = 'barcode-detector';
      setIsScannerOpen(true);
      setScannerMessage('Наведіть камеру на штрихкод товару.');
    } catch (cameraError) {
      logScannerDebug('inventory_scanner_camera_error', {
        stage: 'get_user_media',
        errorName: cameraError instanceof Error ? cameraError.name : 'UnknownError',
        errorMessage: cameraError instanceof Error ? cameraError.message : String(cameraError)
      });
      stopScanner();
      setMessageError(getInventoryScannerCameraErrorMessage(cameraError));
    } finally {
      isStartingScannerRef.current = false;
      setIsStartingScanner(false);
    }
  }

  async function handleCreateProduct() {
    resetMessages();
    setIsCreatingProduct(true);

    try {
      const response = await fetch('/api/inventory/intake/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, product: newProductForm, note: newProductNote })
      });
      const payload = (await response.json()) as ProductPayload;
      if (!response.ok || !payload.ok || !payload.product) {
        throw new Error(payload.error || 'Не вдалося створити новий товар.');
      }

      const createdProduct = payload.product as ProductView;
      setProducts((prev) => [createdProduct, ...prev].sort((a, b) => a.productName.localeCompare(b.productName, 'uk')));
      setProductId(createdProduct.id);
      setUnitsOfMeasurement(createdProduct.unitsOfMeasurement);
      setProductFilter(createdProduct.barcode || createdProduct.productName);
      setIsAddingProduct(false);
      setSuccess(`Новий товар "${createdProduct.productName}" додано в базу.`);
      setNewProductNote('');
    } catch (createError) {
      setMessageError(createError instanceof Error ? createError.message : 'Не вдалося створити новий товар.');
    } finally {
      setIsCreatingProduct(false);
    }
  }

  async function submitBatch(duplicateAction?: 'merge', confirmSuspiciousExpiryDate = false) {
    resetMessages();
    setIsSubmitting(true);

    try {
      const normalizedExpiryDate = normalizeDateForApi(expiryDate);
      const normalizedDeliveryDate = normalizeDateForApi(deliveryDate);
      if (!confirmSuspiciousExpiryDate) {
        const localSuspiciousExpiryDate = getSuspiciousInventoryExpiryDate({
          expiryDate: normalizedExpiryDate,
          deliveryDate: normalizedDeliveryDate
        });
        if (localSuspiciousExpiryDate.isSuspicious) {
          setSuspiciousExpiryDateWarning(localSuspiciousExpiryDate);
          return;
        }
      }
      const response = await fetch('/api/inventory/intake/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          batch: {
            productId,
            batchCode,
            quantity,
            unitsOfMeasurement,
            expiryDate: normalizedExpiryDate,
            deliveryDate: normalizedDeliveryDate,
            notifiedDays: notifiedDays.trim() === '' ? null : notifiedDays
          },
          duplicateAction,
          confirmSuspiciousExpiryDate
        })
      });
      const payload = (await response.json()) as BatchPayload;
      if (response.status === 428 && payload.suspiciousExpiryDate) {
        setSuspiciousExpiryDateWarning(payload.suspiciousExpiryDate);
        return;
      }
      if (response.status === 409 && payload.duplicateBatch) {
        setDuplicateBatch(payload.duplicateBatch);
        return;
      }
      if (!response.ok || !payload.ok || !payload.batch) {
        throw new Error(payload.error || 'Не вдалося зберегти нову партію.');
      }

      setDuplicateBatch(null);
      setSuspiciousExpiryDateWarning(null);
      setSuccess(
        payload.resolution === 'merged'
          ? `Кількість додано до існуючої партії "${payload.batch.productName}". Нова кількість: ${payload.batch.quantity}, термін придатності: ${payload.batch.expiryDate}.`
          : `Партію для товару "${payload.batch.productName}" створено${payload.batch.batchCode ? ` (${payload.batch.batchCode})` : ''}. Кількість: ${payload.batch.quantity}, термін придатності: ${payload.batch.expiryDate}.`
      );
      setProductId('');
      const savedBatchCode = String(payload.batch.batchCode ?? batchCode).trim();
      if (savedBatchCode) {
        setBatchCode(savedBatchCode);
        setBatchSelectionMode('existing');
        setLastBatchCode(savedBatchCode);
        setOpenBatchCodes((prev) => {
          const exists = prev.some((item) => item.batchCode === savedBatchCode);
          if (exists) {
            return prev.map((item) =>
              item.batchCode === savedBatchCode
                ? {
                    ...item,
                    itemCount: item.itemCount + 1,
                    totalQuantity: item.totalQuantity + Number(payload.batch?.quantity ?? 0),
                    latestCreatedAt: new Date().toISOString()
                  }
                : item
            );
          }

          return [
            {
              batchCode: savedBatchCode,
              itemCount: 1,
              totalQuantity: Number(payload.batch?.quantity ?? 0),
              latestCreatedAt: new Date().toISOString()
            },
            ...prev
          ];
        });
        setNextBatchCode((current) => (current && current === savedBatchCode ? incrementBatchCode(current) : current));
      }
      setProducts((prev) =>
        prev.map((item) =>
          item.id === productId && unitsOfMeasurement.trim()
            ? { ...item, unitsOfMeasurement: unitsOfMeasurement.trim() }
            : item
        )
      );
      setQuantity('1');
      setUnitsOfMeasurement('');
      setExpiryDate('');
      setDeliveryDate(formatDateForInput(new Date()));
      setNotifiedDays('');
      setProductFilter('');
      setScannerMessage('');
      setNewProductForm(initialNewProductForm);
      setNewProductNote('');
    } catch (submitError) {
      setMessageError(submitError instanceof Error ? submitError.message : 'Не вдалося зберегти нову партію.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitBatch();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full max-w-3xl rounded-3xl border border-brand/20 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Inventory</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Нова партія товару</h1>
        <p className="mt-2 text-sm text-slate-600">
          Форма відкрита з Telegram. Партія буде записана у ваш магазин і прив'язана до вашого облікового запису.
        </p>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження...</p> : null}
        {loadError ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{loadError}</p> : null}
        {messageError ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{messageError}</p> : null}
        {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {!isLoading && !loadError ? (
          <>
            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Працівник</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{userName || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Магазин</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{storeLabel || '—'}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Сканування штрихкоду</p>
                    <p className="mt-1 text-sm text-slate-600">Відкрийте камеру, наведіть її на штрихкод і товар підтягнеться з бази.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isScannerOpen ? (
                      <button
                        type="button"
                        onClick={stopScanner}
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Закрити камеру
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          void startScanner();
                        }}
                        disabled={isStartingScanner}
                        className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition enabled:hover:bg-brand/5 disabled:opacity-60"
                      >
                        {isStartingScanner ? 'Відкриваємо камеру...' : 'Сканувати штрихкод'}
                      </button>
                    )}
                  </div>
                </div>

                {scannerMessage ? <p className="mt-3 text-sm text-slate-700">{scannerMessage}</p> : null}

                {isScannerOpen ? (
                  <div className="mt-4 rounded-2xl border border-slate-300 bg-slate-950 p-3">
                    <div className="mx-auto flex max-w-sm justify-center overflow-hidden rounded-2xl border border-slate-700 bg-black">
                      <video ref={videoRef} className="h-[320px] w-auto max-w-full object-contain bg-black" autoPlay muted playsInline />
                    </div>
                    <p className="mt-3 text-center text-xs text-slate-300">
                      Компактний preview камери. Якщо штрихкод не зчитується, піднесіть товар ближче або поверніть упаковку.
                    </p>
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">Пошук товару або штрихкод</label>
                <input
                  value={productFilter}
                  onChange={(event) => handleProductFilterChange(event.target.value)}
                  placeholder="Назва, артикул, штрихкод або категорія"
                  className={productSearchInputClass}
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  {isSearchingProducts
                    ? 'Шукаємо товари в базі за назвою, артикулом або штрихкодом...'
                    : 'Можна ввести вручну назву товару, артикул або штрихкод.'}
                </p>
                {barcodeLookupMessage ? (
                  <p
                    className={[
                      'mt-1.5 text-sm font-semibold',
                      barcodeLookupStatus === 'found' ? 'text-emerald-700' : 'text-red-700'
                    ].join(' ')}
                  >
                    {barcodeLookupMessage}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">Товар</label>
                <select
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                >
                  <option value="">{products.length === 0 && !productFilter.trim() ? 'Спочатку знайдіть товар вище' : 'Оберіть товар'}</option>
                  {filteredProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {[product.productName, product.article, formatProductBarcodes(product.barcodes, product.barcode)].filter(Boolean).join(' | ')}
                    </option>
                  ))}
                </select>
                {productFilter.trim() && filteredProducts.length === 0 && !isSearchingProducts ? (
                  <p className="mt-1.5 text-xs text-slate-500">
                    За цим запитом товарів не знайдено. Можна створити новий товар нижче.
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddingProduct((prev) => !prev)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {isAddingProduct ? 'Сховати форму нового товару' : 'Товару немає в базі'}
                </button>
              </div>

              {isAddingProduct ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Новий товар</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Якщо товару немає в базі, заповніть поля нижче. Запис про те, хто і коли додав товар, разом з приміткою, буде збережений для перевірки адміністратором.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={String(newProductForm.article ?? '')}
                      onChange={(event) => setNewProductForm((prev) => ({ ...prev, article: event.target.value }))}
                      placeholder="Артикул *"
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                    />
                    <input
                      value={String(newProductForm.barcode ?? '')}
                      onChange={(event) => setNewProductForm((prev) => ({ ...prev, barcode: event.target.value }))}
                      placeholder="Штрихкоди через кому"
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                    />
                  </div>

                  <input
                    value={String(newProductForm.productName ?? '')}
                    onChange={(event) => setNewProductForm((prev) => ({ ...prev, productName: event.target.value }))}
                    placeholder="Назва товару *"
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                  />

                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      value={String(newProductForm.unitsOfMeasurement ?? '')}
                      onChange={(event) => setNewProductForm((prev) => ({ ...prev, unitsOfMeasurement: event.target.value }))}
                      placeholder="Одиниця виміру *"
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                    />
                    <input
                      value={String(newProductForm.category ?? '')}
                      onChange={(event) => setNewProductForm((prev) => ({ ...prev, category: event.target.value }))}
                      placeholder="Категорія"
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                    />
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={Number(newProductForm.notifiedDaysDefault ?? 7)}
                      onChange={(event) => setNewProductForm((prev) => ({ ...prev, notifiedDaysDefault: Number(event.target.value || 7) }))}
                      placeholder="Днів до сповіщення"
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                    />
                  </div>

                  <textarea
                    value={newProductNote}
                    onChange={(event) => setNewProductNote(event.target.value)}
                    placeholder="Примітка для адміністратора: звідки взявся товар, уточнення по назві, упаковці, штрихкоду тощо"
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        void handleCreateProduct();
                      }}
                      disabled={isCreatingProduct}
                      className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5 disabled:opacity-60"
                    >
                      {isCreatingProduct ? 'Створення товару...' : 'Додати новий товар'}
                    </button>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900">Партія постачання</label>
                    <input
                      type="text"
                      value={batchCode}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setBatchCode(nextValue);
                        setBatchSelectionMode(nextValue.trim() ? 'existing' : 'new');
                      }}
                      placeholder={nextBatchCode ? `Нова партія автоматично: ${nextBatchCode}` : 'Залиште порожнім для нової партії'}
                      list="open-inventory-batch-codes"
                      className={[
                        'mt-1.5 w-full rounded-xl border p-3 text-sm outline-none transition',
                        batchSelectionMode === 'existing'
                          ? 'border-brand bg-brand/5 ring-2 ring-brand/15 focus:border-brand'
                          : 'border-slate-300 bg-white focus:border-brand'
                      ].join(' ')}
                    />
                    <datalist id="open-inventory-batch-codes">
                      {openBatchCodes.map((batch) => (
                        <option key={batch.batchCode} value={batch.batchCode}>
                          {`${batch.itemCount} товарів, ${batch.totalQuantity} од.`}
                        </option>
                      ))}
                    </datalist>
                    <div className="mt-2 space-y-2 text-xs text-slate-500">
                      <p>
                        Залиште поле порожнім, щоб відкрити нову партію автоматично. Для поточної поставки залишайте цей самий код при додаванні наступних товарів.
                      </p>
                      {lastBatchCode ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBatchCode(lastBatchCode);
                            setBatchSelectionMode('existing');
                          }}
                          className="rounded-full border border-slate-300 px-3 py-1 font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Використати останню партію: {lastBatchCode}
                        </button>
                      ) : null}
                      {nextBatchCode ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBatchCode('');
                            setBatchSelectionMode('new');
                          }}
                          className="ml-0 rounded-full border border-brand px-3 py-1 font-semibold text-brand transition hover:bg-brand/5"
                        >
                          Створити нову партію автоматично: {nextBatchCode}
                        </button>
                      ) : null}
                    </div>
                    <div
                      className={[
                        'mt-3 rounded-2xl border px-4 py-3',
                        batchSelectionMode === 'existing'
                          ? 'border-brand bg-brand/10'
                          : 'border-emerald-200 bg-emerald-50'
                      ].join(' ')}
                    >
                      {batchSelectionMode === 'existing' ? (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Обрана партія</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{trimmedBatchCode || '—'}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {selectedOpenBatch
                              ? `${selectedOpenBatch.itemCount} товарів • ${selectedOpenBatch.totalQuantity} од. у відкритій поставці`
                              : 'Використовується вибраний код партії для поточної поставки.'}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Нова партія</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{nextBatchCode || 'Буде сформована автоматично'}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            Якщо сьогодні ще немає відкритих партій, перша нова позиція піде в нову партію автоматично.
                          </p>
                        </>
                      )}
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Відкриті партії сьогодні</p>
                      {openBatchCodes.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {openBatchCodes.map((batch) => (
                            <button
                              key={batch.batchCode}
                              type="button"
                              onClick={() => {
                                setBatchCode(batch.batchCode);
                                setBatchSelectionMode('existing');
                              }}
                              className={[
                                'rounded-full border px-3 py-1 text-xs font-semibold transition',
                                batchCode === batch.batchCode
                                  ? 'border-brand bg-brand text-white shadow-sm ring-2 ring-brand/20'
                                  : 'border-slate-300 bg-white text-slate-700 hover:border-brand hover:text-brand'
                              ].join(' ')}
                            >
                              {batch.batchCode} · {batch.itemCount} товарів
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">
                          Сьогодні ще немає відкритих партій. Перша збережена позиція створить партію автоматично.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900">Кількість товару</label>
                      <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900">Одиниця вимірювання</label>
                      <input
                        type="text"
                        value={unitsOfMeasurement}
                        onChange={(event) => setUnitsOfMeasurement(event.target.value)}
                        placeholder={selectedProduct?.unitsOfMeasurement || 'Наприклад: шт, кг, л'}
                        className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900">Коли повідомляти про завершення терміну придатності</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={notifiedDays}
                      onChange={(event) => setNotifiedDays(event.target.value)}
                      placeholder="За скільки днів до завершення"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Якщо поле порожнє, використовується стандартне значення з картки товару.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <DateInputField label="Термін придатності" value={expiryDate} onChange={setExpiryDate} />
                  <DateInputField
                    label="Дата поставки"
                    value={deliveryDate}
                    onChange={setDeliveryDate}
                    hint="За замовчуванням стоїть сьогоднішня дата. Можна вписати її вручну або вибрати через календар."
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Збереження...' : 'Зберегти нову партію'}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : null}
      </section>
      {duplicateBatch ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Підтвердження</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Така партія вже є</h3>
            <p className="mt-2 text-sm text-slate-600">
              У вашому магазині вже є цей товар з таким самим терміном придатності. Окремий дубль створити неможливо: кількість можна додати до існуючої партії або скасувати дію.
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold text-slate-900">Товар:</span> {duplicateBatch.productName}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">Магазин:</span> {duplicateBatch.storeLabel}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">Термін:</span> {duplicateBatch.expiryDate}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">Поточна кількість:</span> {duplicateBatch.quantity}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">Код партії:</span> {duplicateBatch.batchCode || '—'}</p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDuplicateBatch(null)}
                disabled={isSubmitting}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitBatch('merge');
                }}
                disabled={isSubmitting}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSubmitting ? 'Збереження...' : 'Додати до існуючої'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {suspiciousExpiryDateWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Підтвердження дати</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              {suspiciousExpiryDateWarning.title || 'Перевірте термін придатності'}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{suspiciousExpiryDateWarning.message}</p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold text-slate-900">Термін придатності:</span> {expiryDate || '—'}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">Дата поставки:</span> {deliveryDate || '—'}</p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setSuspiciousExpiryDateWarning(null)}
                disabled={isSubmitting}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Повернутися
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitBatch(undefined, true);
                }}
                disabled={isSubmitting}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSubmitting ? 'Збереження...' : 'Підтвердити і зберегти'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
