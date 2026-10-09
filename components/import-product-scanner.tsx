'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type PublicProduct = { article: string; name: string; barcode: string | null };

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/\.0+$/, '');
}

export default function ImportProductScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<{ reset?: () => void } | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingRef = useRef(false);
  const [code, setCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [product, setProduct] = useState<PublicProduct | null>(null);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current?.reset?.();
    readerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsScanning(false);
  }, []);

  const submitCode = useCallback(async (rawCode: string) => {
    const normalizedCode = normalizeCode(rawCode);
    if (!normalizedCode) {
      setProduct(null);
      setMessage('Введіть код товару або скористайтеся камерою.');
      return;
    }

    setIsSearching(true);
    setProduct(null);
    setMessage('Шукаємо товар…');
    try {
      const response = await fetch(`/api/product-info/lookup?code=${encodeURIComponent(normalizedCode)}`);
      const payload = (await response.json()) as { product?: PublicProduct; error?: string };
      if (!response.ok || !payload.product) {
        setMessage(payload.error ?? `Товар з кодом ${normalizedCode} не знайдено.`);
        return;
      }
      setProduct(payload.product);
      setMessage('');
      stopScanner();
    } catch {
      setMessage('Не вдалося з’єднатися з базою товарів. Спробуйте ще раз.');
    } finally {
      setIsSearching(false);
    }
  }, [stopScanner]);

  useEffect(() => () => {
    controlsRef.current?.stop();
    readerRef.current?.reset?.();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startScanner() {
    if (!window.isSecureContext) {
      setMessage('Сканування камерою працює лише через захищене HTTPS-з’єднання.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Ваш браузер не підтримує доступ до камери. Введіть код вручну.');
      return;
    }

    setProduct(null);
    setMessage('Відкриваємо камеру…');
    try {
      stopScanner();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setIsScanning(true);

      window.setTimeout(async () => {
        if (!videoRef.current || streamRef.current !== stream) return;
        try {
          const { BarcodeFormat, BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 500, delayBetweenScanSuccess: 500 });
          reader.possibleFormats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39];
          readerRef.current = reader as { reset?: () => void };
          controlsRef.current = await reader.decodeFromStream(stream, videoRef.current, (result) => {
            if (!result || processingRef.current) return;
            processingRef.current = true;
            const detectedCode = result.getText();
            setCode(detectedCode);
            void submitCode(detectedCode).finally(() => { processingRef.current = false; });
          });
          setMessage('Наведіть камеру на штрихкод товару.');
        } catch {
          stopScanner();
          setMessage('Не вдалося запустити сканер. Введіть код вручну.');
        }
      }, 0);
    } catch {
      stopScanner();
      setMessage('Не вдалося відкрити камеру. Дозвольте доступ до неї або введіть код вручну.');
    }
  }

  return (
    <section className="rounded-3xl border border-brand/25 bg-white p-5 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Інформація про імпортні товари</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Знайти товар</h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-700">Відскануйте штрихкод на упаковці або введіть штрихкод чи артикул вручну.</p>

      <div className="mt-7 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl bg-[#f6faef] p-5">
          <h2 className="text-lg font-bold text-slate-900">Сканувати штрихкод</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">Дозвольте доступ до камери та наведіть її на штрихкод товару.</p>
          <button type="button" onClick={isScanning ? stopScanner : startScanner} className="mt-5 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90">
            {isScanning ? 'Закрити камеру' : 'Сканувати камерою'}
          </button>
          <div className={isScanning ? 'mt-5 overflow-hidden rounded-xl bg-black' : 'hidden'}><video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline autoPlay /></div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void submitCode(code); }} className="rounded-2xl border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-900">Ввести код вручну</h2>
          <label htmlFor="product-code" className="mt-4 block text-sm font-medium text-slate-700">Штрихкод або артикул</label>
          <input id="product-code" value={code} onChange={(event) => { setCode(event.target.value); setMessage(''); setProduct(null); }} inputMode="numeric" autoComplete="off" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20" placeholder="Введіть код" />
          <button type="submit" disabled={isSearching} className="mt-4 rounded-full border border-brand px-5 py-3 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white disabled:cursor-wait disabled:opacity-60">{isSearching ? 'Шукаємо…' : 'Знайти товар'}</button>
        </form>
      </div>

      {message ? <p role="status" className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
      {product ? <section className="mt-5 rounded-2xl border border-brand/25 bg-brand/5 p-5"><p className="text-sm font-medium text-slate-600">Товар знайдено</p><h2 className="mt-1 text-xl font-bold text-slate-900">{product.name}</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-600">Артикул</dt><dd className="mt-1 font-semibold text-slate-900">{product.article}</dd></div><div><dt className="text-slate-600">Штрихкод</dt><dd className="mt-1 font-semibold text-slate-900">{product.barcode ?? normalizeCode(code)}</dd></div></dl></section> : null}
    </section>
  );
}
