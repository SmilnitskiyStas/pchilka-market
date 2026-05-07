'use client';

import { FormEvent, useRef, useState } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics-events';
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

const MARKETING_FORMAT_OPTIONS = [
  'Банер / плакат на фасаді',
  'Реклама у торговому залі',
  'Реклама у касовій зоні',
  'Промоактивність у магазині',
  'Розміщення в каталозі акцій',
  'Додаткове обладнання',
  'Інше'
] as const;

type StoredMarketingServiceRequest = {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  marketingFormat: string;
  preferredStore: string;
  campaignPeriod: string;
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

export default function CooperationMarketingServicesForm() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [marketingFormat, setMarketingFormat] = useState('');
  const [preferredStore, setPreferredStore] = useState('');
  const [campaignPeriod, setCampaignPeriod] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const phoneInvalid = phone.trim().length > 0 && !isValidPhone(phone);
  const emailInvalid = email.trim().length > 0 && !isValidEmail(email);

  const canSubmit =
    companyName.trim().length > 0 &&
    contactPerson.trim().length > 0 &&
    !phoneInvalid &&
    !emailInvalid &&
    marketingFormat.trim().length > 0 &&
    preferredStore.trim().length > 0 &&
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

    let uploadedAttachment: StoredMarketingServiceRequest['attachment'] = null;
    if (attachment) {
      const uploaded = await uploadRequestAttachment(attachment, {
        folder: 'forms/cooperation/marketing-services'
      });
      uploadedAttachment = {
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        fileType: uploaded.fileType,
        lastModified: uploaded.lastModified,
        url: uploaded.url
      };
    }

    const payload: StoredMarketingServiceRequest = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      companyName: companyName.trim().slice(0, 160),
      contactPerson: contactPerson.trim().slice(0, 120),
      phone: phone.trim().slice(0, 40),
      email: email.trim().slice(0, 160),
      marketingFormat,
      preferredStore: preferredStore.trim().slice(0, 220),
      campaignPeriod: campaignPeriod.trim().slice(0, 120),
      attachment: uploadedAttachment,
      message: message.trim().slice(0, 2000),
      createdAt: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'cooperation_marketing_services',
          companyName: payload.companyName,
          contactPerson: payload.contactPerson,
          phone: payload.phone,
          email: payload.email,
          targetStore: payload.preferredStore,
          message: payload.message,
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : '/cooperation/marketing-services',
          metadata: {
            marketingFormat: payload.marketingFormat,
            campaignPeriod: payload.campaignPeriod,
            attachment: payload.attachment
          }
        })
      });
      const responsePayload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !responsePayload.ok) {
        throw new Error(responsePayload.error || 'Не вдалося надіслати запит.');
      }

      setCompanyName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setMarketingFormat('');
      setPreferredStore('');
      setCampaignPeriod('');
      setAttachment(null);
      setMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      trackAnalyticsEvent('form_submit', {
        form_name: 'cooperation_marketing_services',
        form_type: 'cooperation',
        page_path: typeof window !== 'undefined' ? window.location.pathname : '/cooperation/marketing-services'
      });
      setSubmitMessage('Дякуємо! Запит на маркетингові послуги надіслано.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не вдалося надіслати запит. Спробуйте ще раз.';
      setSubmitMessage(message);
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Форма запиту на маркетингові послуги</h2>
      <p className="mt-1 text-sm text-slate-600">
        Заповніть деталі розміщення, включно з бажаним магазином, і ми зв'яжемося з вами.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="marketing-company" className="block text-sm font-semibold text-slate-900">
              Компанія <span className="text-red-600">*</span>
            </label>
            <input
              id="marketing-company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              maxLength={160}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="Назва компанії"
            />
          </div>
          <div>
            <label htmlFor="marketing-contact" className="block text-sm font-semibold text-slate-900">
              Контактна особа <span className="text-red-600">*</span>
            </label>
            <input
              id="marketing-contact"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              maxLength={120}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="ПІБ"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="marketing-phone" className="block text-sm font-semibold text-slate-900">
              Телефон <span className="text-red-600">*</span>
            </label>
            <input
              id="marketing-phone"
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
          <div>
            <label htmlFor="marketing-email" className="block text-sm font-semibold text-slate-900">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              id="marketing-email"
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="marketing-format" className="block text-sm font-semibold text-slate-900">
              Формат розміщення <span className="text-red-600">*</span>
            </label>
            <select
              id="marketing-format"
              value={marketingFormat}
              onChange={(e) => setMarketingFormat(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            >
              <option value="">Оберіть формат</option>
              {MARKETING_FORMAT_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="marketing-period" className="block text-sm font-semibold text-slate-900">
              Бажаний період розміщення
            </label>
            <input
              id="marketing-period"
              value={campaignPeriod}
              onChange={(e) => setCampaignPeriod(e.target.value)}
              maxLength={120}
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="Наприклад: березень-квітень 2026"
            />
          </div>
        </div>

        <div>
          <label htmlFor="marketing-store" className="block text-sm font-semibold text-slate-900">
            На якому магазині / адресі хочете розміщення <span className="text-red-600">*</span>
          </label>
          <input
            id="marketing-store"
            value={preferredStore}
            onChange={(e) => setPreferredStore(e.target.value)}
            maxLength={220}
            required
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            placeholder="Місто, адреса магазину або декілька локацій"
          />
        </div>

        <div>
          <label htmlFor="marketing-message" className="block text-sm font-semibold text-slate-900">
            Деталі запиту <span className="text-red-600">*</span>
          </label>
          <textarea
            id="marketing-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            minLength={MIN_MESSAGE_LENGTH}
            maxLength={2000}
            required
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            placeholder="Опишіть товари/бренд, формат розміщення, очікувані обсяги й додаткові вимоги."
          />
          <p className="mt-1 text-xs text-slate-500">
            {message.length}/2000 (мінімум {MIN_MESSAGE_LENGTH})
          </p>
        </div>

        <div>
          <label htmlFor="marketing-file" className="block text-sm font-semibold text-slate-900">
            Файл (не обов'язково)
          </label>
          <input
            id="marketing-file"
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
            Надіслати запит
          </button>
        </div>
      </form>
    </section>
  );
}
