'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { uploadRequestAttachment } from '@/lib/request-attachment-client';

const MIN_MESSAGE_LENGTH = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'txt'];

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function normalizePhoneInput(value: string) {
  return value.replace(/[^\d+()\-\s]/g, '');
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function isValidAttachment(file: File | null) {
  if (!file) return true;
  if (file.size > MAX_FILE_SIZE_BYTES) return false;
  const extension = getFileExtension(file.name);
  return ALLOWED_FILE_EXTENSIONS.includes(extension);
}

const AREA_OPTIONS = [
  '250-499 м2',
  '500-999 м2',
  '1000-1499 м2',
  '1500-2000 м2',
  'Понад 2000 м2'
] as const;

const ROOM_TYPE_OPTIONS = [
  'Окремо стояча будівля',
  'Приміщення у ТРЦ / торговому центрі',
  'Вбудоване приміщення',
  'Перший поверх житлового будинку',
  'Склад + торгова зона',
  'Інше'
] as const;

type ParkingAvailability = 'yes' | 'no' | 'possible';

type StoredSearchRoomRequest = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  roomType: string;
  areaRange: string;
  parkingAvailability: ParkingAvailability;
  parkingCountApprox: string;
  attachment: {
    fileName: string;
    fileSize: number;
    fileType: string;
    lastModified: number;
    url?: string;
  } | null;
  message: string;
  createdAt: string;
};

export default function CooperationSearchRoomForm() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [roomType, setRoomType] = useState('');
  const [areaRange, setAreaRange] = useState('');
  const [parkingAvailability, setParkingAvailability] = useState<ParkingAvailability | ''>('');
  const [parkingCountApprox, setParkingCountApprox] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const phoneInvalid = phone.trim().length > 0 && !isValidPhone(phone);
  const emailInvalid = email.trim().length > 0 && !isValidEmail(email);

  useEffect(() => {
    if (parkingAvailability === 'no') {
      setParkingCountApprox('');
    }
  }, [parkingAvailability]);

  const canSubmit =
    fullName.trim().length > 0 &&
    !phoneInvalid &&
    !emailInvalid &&
    city.trim().length > 0 &&
    address.trim().length > 0 &&
    roomType.trim().length > 0 &&
    areaRange.trim().length > 0 &&
    parkingAvailability !== '' &&
    (parkingAvailability !== 'yes' || parkingCountApprox.trim().length > 0) &&
    isValidAttachment(attachment) &&
    message.trim().length >= MIN_MESSAGE_LENGTH;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitMessage('');

    if (!canSubmit) {
      if (!isValidPhone(phone)) {
        setSubmitMessage('Перевірте номер телефону: має бути 10-15 цифр.');
        return;
      }
      if (!isValidEmail(email)) {
        setSubmitMessage('Перевірте правильність email.');
        return;
      }
      if (!isValidAttachment(attachment)) {
        setSubmitMessage('Файл має бути до 10MB і в дозволеному форматі.');
        return;
      }
      return;
    }
    const selectedParkingAvailability = parkingAvailability as ParkingAvailability;

    let uploadedAttachment: StoredSearchRoomRequest['attachment'] = null;
    if (attachment) {
      const uploaded = await uploadRequestAttachment(attachment, {
        folder: 'forms/cooperation/search-room'
      });
      uploadedAttachment = {
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        fileType: uploaded.fileType,
        lastModified: uploaded.lastModified,
        url: uploaded.url
      };
    }

    const payload: StoredSearchRoomRequest = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fullName: fullName.trim().slice(0, 120),
      phone: phone.trim().slice(0, 40),
      email: email.trim().slice(0, 160),
      city: city.trim().slice(0, 80),
      address: address.trim().slice(0, 200),
      roomType,
      areaRange,
      parkingAvailability: selectedParkingAvailability,
      parkingCountApprox:
        selectedParkingAvailability === 'no' ? '' : parkingCountApprox.trim().slice(0, 40),
      attachment: uploadedAttachment,
      message: message.trim().slice(0, 2000),
      createdAt: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'cooperation_search_room',
          fullName: payload.fullName,
          phone: payload.phone,
          email: payload.email,
          city: payload.city,
          targetStore: payload.address,
          message: payload.message,
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : '/cooperation/search-room',
          metadata: {
            roomType: payload.roomType,
            areaRange: payload.areaRange,
            parkingAvailability: payload.parkingAvailability,
            parkingCountApprox: payload.parkingCountApprox,
            attachment: payload.attachment
          }
        })
      });
      const responsePayload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !responsePayload.ok) {
        throw new Error(responsePayload.error || 'Не вдалося надіслати заявку.');
      }

      setFullName('');
      setPhone('');
      setEmail('');
      setCity('');
      setAddress('');
      setRoomType('');
      setAreaRange('');
      setParkingAvailability('');
      setParkingCountApprox('');
      setAttachment(null);
      setMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      setSubmitMessage('Дякуємо! Пропозицію приміщення надіслано.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не вдалося надіслати заявку. Спробуйте ще раз.';
      setSubmitMessage(message);
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Форма пропозиції приміщення</h2>
      <p className="mt-1 text-sm text-slate-600">Заповніть дані про приміщення, і відділ розвитку зв'яжеться з вами.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="search-room-name" className="block text-sm font-semibold text-slate-900">
              ПІБ <span className="text-red-600">*</span>
            </label>
            <input
              id="search-room-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="Ваше ім'я та прізвище"
            />
          </div>
          <div>
            <label htmlFor="search-room-phone" className="block text-sm font-semibold text-slate-900">
              Телефон <span className="text-red-600">*</span>
            </label>
            <input
              id="search-room-phone"
              value={phone}
              onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
              maxLength={40}
              inputMode="tel"
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="+38 (0XX) XXX-XX-XX"
            />
            {phoneInvalid ? (
              <p className="mt-1 text-xs font-semibold text-red-600">Номер має містити від 10 до 15 цифр.</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="search-room-email" className="block text-sm font-semibold text-slate-900">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              id="search-room-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={160}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="name@example.com"
            />
            {emailInvalid ? (
              <p className="mt-1 text-xs font-semibold text-red-600">Вкажіть email у форматі name@example.com.</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="search-room-city" className="block text-sm font-semibold text-slate-900">
              Місто / населений пункт <span className="text-red-600">*</span>
            </label>
            <input
              id="search-room-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={80}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="Київ"
            />
          </div>
        </div>

        <div>
          <label htmlFor="search-room-address" className="block text-sm font-semibold text-slate-900">
            Адреса приміщення <span className="text-red-600">*</span>
          </label>
          <input
            id="search-room-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
            required
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            placeholder="вул. Прикладна, 10"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="search-room-type" className="block text-sm font-semibold text-slate-900">
              Тип приміщення <span className="text-red-600">*</span>
            </label>
            <select
              id="search-room-type"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            >
              <option value="">Оберіть тип приміщення</option>
              {ROOM_TYPE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search-room-area" className="block text-sm font-semibold text-slate-900">
              Квадратура приміщення <span className="text-red-600">*</span>
            </label>
            <select
              id="search-room-area"
              value={areaRange}
              onChange={(e) => setAreaRange(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            >
              <option value="">Оберіть діапазон площі</option>
              {AREA_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            Чи є парковка? <span className="text-red-600">*</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="parking-availability"
                value="yes"
                checked={parkingAvailability === 'yes'}
                onChange={() => setParkingAvailability('yes')}
              />
              Так
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="parking-availability"
                value="possible"
                checked={parkingAvailability === 'possible'}
                onChange={() => setParkingAvailability('possible')}
              />
              Можна облаштувати
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="parking-availability"
                value="no"
                checked={parkingAvailability === 'no'}
                onChange={() => setParkingAvailability('no')}
              />
              Немає
            </label>
          </div>

          <div className="mt-3">
            <label htmlFor="search-room-parking-count" className="block text-sm font-semibold text-slate-900">
              Приблизна кількість паркомісць {parkingAvailability === 'yes' ? <span className="text-red-600">*</span> : null}
            </label>
            <input
              id="search-room-parking-count"
              value={parkingCountApprox}
              onChange={(e) => setParkingCountApprox(e.target.value)}
              maxLength={40}
              required={parkingAvailability === 'yes'}
              disabled={parkingAvailability === 'no'}
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="Наприклад: 20-30"
            />
          </div>
        </div>

        <div>
          <label htmlFor="search-room-message" className="block text-sm font-semibold text-slate-900">
            Коментар <span className="text-red-600">*</span>
          </label>
          <textarea
            id="search-room-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            minLength={MIN_MESSAGE_LENGTH}
            maxLength={2000}
            required
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            placeholder="Вкажіть додаткові деталі: стан приміщення, потужність електрики, рампа тощо."
          />
          <p className="mt-1 text-xs text-slate-500">
            {message.length}/2000 (мінімум {MIN_MESSAGE_LENGTH})
          </p>
        </div>

        <div>
          <label htmlFor="search-room-file" className="block text-sm font-semibold text-slate-900">
            Файл (не обов'язково)
          </label>
          <input
            id="search-room-file"
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-semibold file:text-brand hover:file:bg-brand/20"
          />
          {attachment ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Додано: {attachment.name} ({Math.max(1, Math.round(attachment.size / 1024))} KB)
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {submitMessage ? <p className="mr-auto text-sm font-semibold text-brand">{submitMessage}</p> : null}
          <button
            type="submit"
            disabled={!canSubmit}
            className="ml-auto rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Надіслати пропозицію
          </button>
        </div>
      </form>
    </section>
  );
}
