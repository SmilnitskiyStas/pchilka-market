'use client';

import { FormEvent, useRef, useState } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics-events';
import { uploadRequestAttachment } from '@/lib/request-attachment-client';

const MIN_MESSAGE_LENGTH = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'webp'];

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

type CareerApplicationFormProps = {
  vacancies: string[];
};

type StoredCareerApplication = {
  id: string;
  fullName: string;
  age: number;
  phone: string;
  email: string;
  city: string;
  selectedVacancy: string;
  resumeLink: string;
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

export default function CareerApplicationForm({ vacancies }: CareerApplicationFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [selectedVacancy, setSelectedVacancy] = useState('');
  const [resumeLink, setResumeLink] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const phoneInvalid = phone.trim().length > 0 && !isValidPhone(phone);
  const emailInvalid = email.trim().length > 0 && !isValidEmail(email);

  const numericAge = Number(age);
  const isAgeValid = Number.isInteger(numericAge) && numericAge >= 14 && numericAge <= 100;

  const canSubmit =
    fullName.trim().length > 0 &&
    isAgeValid &&
    !phoneInvalid &&
    !emailInvalid &&
    city.trim().length > 0 &&
    selectedVacancy.trim().length > 0 &&
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

    let uploadedAttachment: StoredCareerApplication['attachment'] = null;
    if (attachment) {
      const uploaded = await uploadRequestAttachment(attachment, {
        folder: 'forms/career/application'
      });
      uploadedAttachment = {
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        fileType: uploaded.fileType,
        lastModified: uploaded.lastModified,
        url: uploaded.url
      };
    }

    const payload: StoredCareerApplication = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fullName: fullName.trim().slice(0, 120),
      age: numericAge,
      phone: phone.trim().slice(0, 40),
      email: email.trim().slice(0, 160),
      city: city.trim().slice(0, 80),
      selectedVacancy,
      resumeLink: resumeLink.trim().slice(0, 300),
      attachment: uploadedAttachment,
      message: message.trim().slice(0, 2000),
      createdAt: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'career_application',
          fullName: payload.fullName,
          phone: payload.phone,
          email: payload.email,
          city: payload.city,
          vacancy: payload.selectedVacancy,
          message: payload.message,
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : '/career',
          metadata: {
            age: payload.age,
            resumeLink: payload.resumeLink,
            attachment: payload.attachment
          }
        })
      });
      const responsePayload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !responsePayload.ok) {
        throw new Error(responsePayload.error || 'Не вдалося надіслати заявку.');
      }

      setFullName('');
      setAge('');
      setPhone('');
      setEmail('');
      setCity('');
      setSelectedVacancy('');
      setResumeLink('');
      setAttachment(null);
      setMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      trackAnalyticsEvent('form_submit', {
        form_name: 'career_application',
        form_type: 'career',
        has_attachment: Boolean(attachment),
        page_path: typeof window !== 'undefined' ? window.location.pathname : '/career'
      });
      setSubmitMessage('Дякуємо! Вашу заявку надіслано.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не вдалося надіслати заявку. Спробуйте ще раз.';
      setSubmitMessage(message);
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Форма відгуку на вакансію</h2>
      <p className="mt-1 text-sm text-slate-600">Оберіть посаду зі списку та залиште ваші контактні дані.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="career-full-name" className="block text-sm font-semibold text-slate-900">
              ПІБ <span className="text-red-600">*</span>
            </label>
            <input
              id="career-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="Ваше ім'я та прізвище"
            />
          </div>
          <div>
            <label htmlFor="career-city" className="block text-sm font-semibold text-slate-900">
              Місто <span className="text-red-600">*</span>
            </label>
            <input
              id="career-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={80}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="Київ"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="career-age" className="block text-sm font-semibold text-slate-900">
              Вік <span className="text-red-600">*</span>
            </label>
            <input
              id="career-age"
              type="number"
              min={14}
              max={100}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="Наприклад: 28"
            />
          </div>
          <div>
            <label htmlFor="career-phone" className="block text-sm font-semibold text-slate-900">
              Телефон <span className="text-red-600">*</span>
            </label>
            <input
              id="career-phone"
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
            <label htmlFor="career-email" className="block text-sm font-semibold text-slate-900">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              id="career-email"
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

        <div>
          <label htmlFor="career-vacancy" className="block text-sm font-semibold text-slate-900">
            Посада <span className="text-red-600">*</span>
          </label>
          <select
            id="career-vacancy"
            value={selectedVacancy}
            onChange={(e) => setSelectedVacancy(e.target.value)}
            required
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
          >
            <option value="">Оберіть посаду</option>
            {vacancies.map((vacancy) => (
              <option key={vacancy} value={vacancy}>
                {vacancy}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="career-file" className="block text-sm font-semibold text-slate-900">
            Файл (резюме/документ, не обов'язково)
          </label>
          <input
            id="career-file"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,image/*"
            onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-semibold file:text-brand hover:file:bg-brand/20"
          />
          {attachment ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Додано: {attachment.name} ({Math.max(1, Math.round(attachment.size / 1024))} KB)
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="career-resume" className="block text-sm font-semibold text-slate-900">
            Посилання на резюме (не обов'язково)
          </label>
          <input
            id="career-resume"
            value={resumeLink}
            onChange={(e) => setResumeLink(e.target.value)}
            maxLength={300}
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            placeholder="https://..."
          />
        </div>

        <div>
          <label htmlFor="career-message" className="block text-sm font-semibold text-slate-900">
            Коментар <span className="text-red-600">*</span>
          </label>
          <textarea
            id="career-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            minLength={MIN_MESSAGE_LENGTH}
            maxLength={2000}
            required
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            placeholder="Коротко розкажіть про ваш досвід або побажання щодо вакансії."
          />
          <p className="mt-1 text-xs text-slate-500">
            {message.length}/2000 (мінімум {MIN_MESSAGE_LENGTH})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {submitMessage ? <p className="mr-auto text-sm font-semibold text-brand">{submitMessage}</p> : null}
          <button
            type="submit"
            disabled={!canSubmit}
            className="ml-auto rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Надіслати заявку
          </button>
        </div>
      </form>
    </section>
  );
}
