'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ProductDetails = { ingredients: string; fruitContent: string; preparationMethod: string; nutritionFat: string; nutritionSaturatedFat: string; nutritionCarbohydrates: string; nutritionSugars: string; nutritionProtein: string; nutritionSalt: string; nutritionEnergy: string; storageConditions: string; shelfLife: string; allergens: string; countryOfOrigin: string; manufacturer: string; importer: string; consumerClaims: string; isGmoFree: boolean; originalName:string; category:string; unit:string; netQuantity:string; netWeightWithoutGlaze:string; alcoholContent:string; mandatoryWarnings:string; freezingStatus:string; additionalCharacteristics:string; vitamins:string; storageBeforeOpening:string; storageAfterOpening:string; consumptionPeriodAfterOpening:string; importerContact:string; supplier:string; supplierContact:string };

type Visibility = Record<string, boolean>;
type PublicProduct = { article: string; name: string; barcode: string | null; details: ProductDetails | null; visibility: Visibility };

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

      <form onSubmit={(event) => { event.preventDefault(); void submitCode(code); }} className="mt-7 rounded-2xl border border-slate-200 p-5">
        <label htmlFor="product-code" className="block text-sm font-medium text-slate-700">Штрихкод або артикул</label>
        <input id="product-code" value={code} onChange={(event) => { setCode(event.target.value); setMessage(''); setProduct(null); }} inputMode="numeric" autoComplete="off" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20" placeholder="Введіть код" />
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={isSearching} className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60">{isSearching ? 'Шукаємо…' : 'Знайти товар'}</button>
          <button type="button" onClick={isScanning ? stopScanner : startScanner} aria-label={isScanning ? 'Закрити камеру' : 'Сканувати штрихкод камерою'} title={isScanning ? 'Закрити камеру' : 'Сканувати камерою'} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand text-brand transition hover:bg-brand hover:text-white" >
            {isScanning ? <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8a2 2 0 0 1 2-2h2l1.2-2h5.6L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" /><circle cx="12" cy="12.5" r="3.2" /></svg>}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Натисніть іконку камери, щоб відсканувати штрихкод.</p>
        {isScanning ? <div className="mt-4 overflow-hidden rounded-xl bg-black"><video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline autoPlay /></div> : null}
      </form>
      {message ? <p role="status" className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
      {product ? <section className="mt-5 rounded-2xl border border-brand/25 bg-brand/5 p-5"><p className="text-sm font-medium text-slate-600">Товар знайдено</p><h2 className="mt-1 text-xl font-bold text-slate-900">{product.name}</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-600">Артикул</dt><dd className="mt-1 font-semibold text-slate-900">{product.article}</dd></div><div><dt className="text-slate-600">Штрихкод</dt><dd className="mt-1 font-semibold text-slate-900">{product.barcode ?? normalizeCode(code)}</dd></div></dl></section> : null}
      {product?.details ? (() => {
        const details = product.details;
        const visible = (key: string) => product.visibility?.[key] !== false;
        const nutritionRows = [
          ['Жири', details.nutritionFat], ['Насичені жири', details.nutritionSaturatedFat], ['Вуглеводи', details.nutritionCarbohydrates],
          ['Цукри', details.nutritionSugars], ['Білок', details.nutritionProtein], ['Сіль', details.nutritionSalt], ['Енергетична цінність', details.nutritionEnergy]
        ].filter(([, value]) => Boolean(value));
        const hasOriginInfo = Boolean((visible('countryOfOrigin') && details.countryOfOrigin) || (visible('manufacturer') && details.manufacturer) || (visible('importer') && details.importer) || (visible('consumerClaims') && details.consumerClaims));
        return <section className="mt-5 space-y-5 rounded-2xl border border-slate-200 p-5 text-sm text-slate-700">
          <h2 className="text-xl font-bold text-slate-900">Інформація про товар</h2>
          {(visible('ingredients') && (details.ingredients || details.fruitContent)) || (visible('preparationMethod') && details.preparationMethod) ? <div>{visible('ingredients') && details.ingredients ? <><h3 className="font-semibold text-slate-900">Склад</h3><p className="mt-1 leading-6">{details.ingredients}</p></> : null}{visible('fruitContent') && details.fruitContent ? <p className="mt-2 font-medium">{details.fruitContent}</p> : null}{visible('preparationMethod') && details.preparationMethod ? <><h3 className="mt-4 font-semibold text-slate-900">Спосіб приготування</h3><p className="mt-1 leading-6">{details.preparationMethod}</p></> : null}</div> : null}
          {visible('nutrition') && nutritionRows.length ? <div className="overflow-hidden rounded-xl border border-slate-200"><div className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">Поживна цінність на 100 мл</div><dl className="divide-y divide-slate-100">{nutritionRows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 px-4 py-2"><dt>{label}</dt><dd className="font-semibold text-slate-900">{value}</dd></div>)}</dl></div> : null}
          {(visible('storageConditions') && details.storageConditions) || (visible('shelfLife') && details.shelfLife) ? <div className="grid gap-4 sm:grid-cols-2">{visible('storageConditions') && details.storageConditions ? <div><h3 className="font-semibold text-slate-900">Зберігання</h3><p className="mt-1 leading-6">{details.storageConditions}</p></div> : null}{visible('shelfLife') && details.shelfLife ? <div><h3 className="font-semibold text-slate-900">Термін реалізації</h3><p className="mt-1 leading-6">{details.shelfLife}</p></div> : null}</div> : null}
          {hasOriginInfo ? <div>{visible('countryOfOrigin') && details.countryOfOrigin ? <><h3 className="font-semibold text-slate-900">Країна походження</h3><p className="mt-1">{details.countryOfOrigin}</p></> : null}{visible('manufacturer') && details.manufacturer ? <><h3 className="mt-3 font-semibold text-slate-900">Виробник</h3><p className="mt-1 leading-6">{details.manufacturer}</p></> : null}{visible('importer') && details.importer ? <><h3 className="mt-3 font-semibold text-slate-900">Імпортер в Україні</h3><p className="mt-1 leading-6">{details.importer}</p></> : null}{visible('consumerClaims') && details.consumerClaims ? <p className="mt-2 font-medium">{details.consumerClaims}</p> : null}</div> : null}
          {(visible('allergens') && details.allergens) || (visible('gmoFree') && details.isGmoFree) ? <div className="rounded-xl bg-brand/5 p-4">{visible('allergens') && details.allergens ? <p>{details.allergens}</p> : null}{visible('gmoFree') && details.isGmoFree ? <p className={details.allergens ? 'mt-2 font-semibold text-slate-900' : 'font-semibold text-slate-900'}>Без ГМО.</p> : null}</div> : null}
          {([['originalName','Назва мовою оригіналу',details.originalName],['category','Категорія',details.category],['unit','Одиниця вимірювання',details.unit],['netQuantity','Маса нетто / об’єм',details.netQuantity],['netWeightWithoutGlaze','Маса без глазурі',details.netWeightWithoutGlaze],['alcoholContent','Вміст алкоголю',details.alcoholContent],['mandatoryWarnings','Обов’язкові застереження',details.mandatoryWarnings],['freezingStatus','Заморожування',details.freezingStatus],['additionalCharacteristics','Додаткові відомості',details.additionalCharacteristics],['vitamins','Вітаміни',details.vitamins],['storageBeforeOpening','Зберігання до відкриття',details.storageBeforeOpening],['storageAfterOpening','Зберігання після відкриття',details.storageAfterOpening],['consumptionPeriodAfterOpening','Строк споживання після відкриття',details.consumptionPeriodAfterOpening],['importerContact','Контакти імпортера',details.importerContact],['supplier','Постачальник',details.supplier],['supplierContact','Контакти постачальника',details.supplierContact]] as const).filter(([key,,value]) => visible(key) && Boolean(value)).map(([, label, value]) => <div key={label}><h3 className="font-semibold text-slate-900">{label}</h3><p className="mt-1 leading-6">{value}</p></div>)}
        </section>;
      })() : null}
    </section>
  );
}

