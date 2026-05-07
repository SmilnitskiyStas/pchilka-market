'use client';

import { FormEvent, useRef, useState } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics-events';
import { uploadRequestAttachment } from '@/lib/request-attachment-client';

const MIN_MESSAGE_LENGTH = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'];

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

type ProductCategoryOption = {
  label: string;
  recipientEmail: string;
  managerName?: string;
};

type StoredCooperationRequest = {
  id: string;
  fullName: string;
  company: string;
  phone: string;
  email: string;
  message: string;
  selectedCategory?: string;
  recipientEmail?: string;
  attachment: {
    fileName: string;
    fileSize: number;
    fileType: string;
    lastModified: number;
    url?: string;
  } | null;
  createdAt: string;
};

type CooperationOfferFormProps = {
  mode?: 'general' | 'product';
  productCategories?: ProductCategoryOption[];
  storageKey?: string;
  submitButtonLabel?: string;
};

export default function CooperationOfferForm({
  mode = 'general',
  productCategories = [],
  storageKey = 'cooperation_offer_requests',
  submitButtonLabel = 'Надіслати запит'
}: CooperationOfferFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');

  const selectedCategory =
    mode === 'product'
      ? productCategories.find((item) => item.label === selectedCategoryLabel) ?? null
      : null;
  const phoneInvalid = phone.trim().length > 0 && !isValidPhone(phone);
  const emailInvalid = email.trim().length > 0 && !isValidEmail(email);

  const canSubmit =
    fullName.trim().length > 0 &&
    company.trim().length > 0 &&
    !phoneInvalid &&
    !emailInvalid &&
    (mode === 'general' || selectedCategory !== null) &&
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

    let uploadedAttachment: StoredCooperationRequest['attachment'] = null;
    if (attachment) {
      const uploaded = await uploadRequestAttachment(attachment, {
        folder: mode === 'product' ? 'forms/cooperation/product' : 'forms/cooperation/general'
      });
      uploadedAttachment = {
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        fileType: uploaded.fileType,
        lastModified: uploaded.lastModified,
        url: uploaded.url
      };
    }

    const payload: StoredCooperationRequest = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fullName: fullName.trim().slice(0, 120),
      company: company.trim().slice(0, 120),
      phone: phone.trim().slice(0, 40),
      email: email.trim().slice(0, 160),
      message: message.trim().slice(0, 2000),
      selectedCategory: selectedCategory?.label,
      recipientEmail: selectedCategory?.recipientEmail,
      attachment: uploadedAttachment,
      createdAt: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: mode === 'product' ? 'cooperation_product' : 'cooperation_general',
          fullName: payload.fullName,
          companyName: payload.company,
          phone: payload.phone,
          email: payload.email,
          subject: payload.selectedCategory || '',
          message: payload.message,
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : '/cooperation',
          metadata: {
            recipientEmail: payload.recipientEmail || '',
            selectedCategory: payload.selectedCategory || '',
            attachment: payload.attachment
          }
        })
      });
      const responsePayload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !responsePayload.ok) {
        throw new Error(responsePayload.error || 'Не вдалося надіслати заявку.');
      }

      setFullName('');
      setCompany('');
      setPhone('');
      setEmail('');
      setMessage('');
      setAttachment(null);
      setSelectedCategoryLabel('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      trackAnalyticsEvent('form_submit', {
        form_name: mode === 'product' ? 'cooperation_offer_product' : 'cooperation_offer_general',
        form_type: 'cooperation',
        has_attachment: Boolean(attachment),
        page_path: typeof window !== 'undefined' ? window.location.pathname : '/cooperation'
      });

      if (mode === 'product' && selectedCategory) {
        const mailSubject = `Пропозиція товару: ${selectedCategory.label}`;
        const bodyLines = [
          `Категорія: ${selectedCategory.label}`,
          selectedCategory.managerName ? `Менеджер: ${selectedCategory.managerName}` : '',
          `ПІБ: ${payload.fullName}`,
          `Компанія: ${payload.company}`,
          `Телефон: ${payload.phone}`,
          `Email: ${payload.email}`,
          '',
          'Повідомлення:',
          payload.message
        ].filter(Boolean);

        const mailtoHref = `mailto:${selectedCategory.recipientEmail}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(
          bodyLines.join('\n')
        )}`;
        window.location.href = mailtoHref;
        setSubmitMessage('Чернетку листа відкрито у вашому поштовому клієнті.');
      } else {
        setSubmitMessage('Дякуємо! Запит на співпрацю надіслано.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не вдалося надіслати запит. Спробуйте ще раз.';
      setSubmitMessage(message);
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Форма співпраці</h2>
      <p className="mt-1 text-sm text-slate-600">Заповніть форму, і ми зв'яжемося з вами.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {mode === 'product' ? (
          <div>
            <label htmlFor="cooperation-category" className="block text-sm font-semibold text-slate-900">
              Категорія товару <span className="text-red-600">*</span>
            </label>
            <select
              id="cooperation-category"
              value={selectedCategoryLabel}
              onChange={(e) => setSelectedCategoryLabel(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            >
              <option value="">Оберіть категорію</option>
              {productCategories.map((category) => (
                <option key={`${category.label}_${category.recipientEmail}`} value={category.label}>
                  {category.managerName ? `${category.label} (${category.managerName})` : category.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cooperation-full-name" className="block text-sm font-semibold text-slate-900">
              ПІБ <span className="text-red-600">*</span>
            </label>
            <input
              id="cooperation-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
              required
              placeholder="Ваше ім'я та прізвище"
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            />
          </div>

          <div>
            <label htmlFor="cooperation-company" className="block text-sm font-semibold text-slate-900">
              Компанія <span className="text-red-600">*</span>
            </label>
            <input
              id="cooperation-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              maxLength={120}
              required
              placeholder="Назва компанії"
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cooperation-phone" className="block text-sm font-semibold text-slate-900">
              Телефон <span className="text-red-600">*</span>
            </label>
            <input
              id="cooperation-phone"
              value={phone}
              onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
              maxLength={40}
              inputMode="tel"
              required
              placeholder="+38 (0XX) XXX-XX-XX"
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            />
            {phoneInvalid ? (
              <p className="mt-1 text-xs font-semibold text-red-600">Номер має містити від 10 до 15 цифр.</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="cooperation-email" className="block text-sm font-semibold text-slate-900">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              id="cooperation-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={160}
              required
              placeholder="name@example.com"
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            />
            {emailInvalid ? (
              <p className="mt-1 text-xs font-semibold text-red-600">Вкажіть email у форматі name@example.com.</p>
            ) : null}
          </div>
        </div>

        <div>
          <label htmlFor="cooperation-message" className="block text-sm font-semibold text-slate-900">
            Повідомлення <span className="text-red-600">*</span>
          </label>
          <textarea
            id="cooperation-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            minLength={MIN_MESSAGE_LENGTH}
            maxLength={2000}
            required
            placeholder="Опишіть деталі вашої пропозиції..."
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
          />
          <p className="mt-1 text-xs text-slate-500">
            {message.length}/2000 (мінімум {MIN_MESSAGE_LENGTH})
          </p>
        </div>

        <div>
          <label htmlFor="cooperation-file" className="block text-sm font-semibold text-slate-900">
            Фото або файл (не обов'язково)
          </label>
          <input
            id="cooperation-file"
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
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
          {submitMessage ? (
            <p className="mr-auto text-sm font-semibold text-brand">{submitMessage}</p>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmit}
            className="ml-auto rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitButtonLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
