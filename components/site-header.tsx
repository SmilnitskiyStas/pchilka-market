'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mainMenu, type MenuItem } from '@/content/menu';
import { trackAnalyticsEvent } from '@/lib/analytics-events';
import { getSiteLogoUrl } from '@/lib/site-branding';
import { defaultSiteProfileSettings } from '@/lib/site-profile-settings';
import { uploadRequestAttachment } from '@/lib/request-attachment-client';

const MIN_MESSAGE_LENGTH = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'txt'];

function toTel(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

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

export default function SiteHeader() {
  const pathname = usePathname();
  const hiddenOnRoutes = ['/loyalty/mobile-app/download'];

  if (pathname && hiddenOnRoutes.includes(pathname)) {
    return null;
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const phonesMenuRef = useRef<HTMLDivElement | null>(null);

  const [openMenuLabel, setOpenMenuLabel] = useState<string | null>(null);
  const [openMobileMenuLabel, setOpenMobileMenuLabel] = useState<string | null>(null);
  const [isPhonesOpen, setIsPhonesOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [contactPhones, setContactPhones] = useState<string[]>(defaultSiteProfileSettings.contactPhones);
  const [logoUrl, setLogoUrl] = useState<string>(defaultSiteProfileSettings.logoUrl);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackPhone, setFeedbackPhone] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackAttachment, setFeedbackAttachment] = useState<File | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const feedbackPhoneInvalid = feedbackPhone.trim().length > 0 && !isValidPhone(feedbackPhone);
  const feedbackEmailInvalid = feedbackEmail.trim().length > 0 && !isValidEmail(feedbackEmail);

  useEffect(() => {
    setOpenMenuLabel(null);
    setOpenMobileMenuLabel(null);
    setIsPhonesOpen(false);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadContacts() {
      try {
        const response = await fetch('/api/admin/site-profile', { cache: 'no-store' });
        const payload = (await response.json()) as { ok?: boolean; settings?: { contactPhones?: string[]; logoUrl?: string } };
        if (!response.ok || !payload.ok || cancelled) return;

        if (Array.isArray(payload.settings?.contactPhones) && payload.settings.contactPhones.length > 0) {
          setContactPhones(payload.settings.contactPhones);
        }
        setLogoUrl(getSiteLogoUrl(payload.settings));
      } catch {
        // Keep default contacts when API is unavailable.
      }
    }

    void loadContacts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPhonesOpen) return;

    const handleOutsidePress = (event: MouseEvent | TouchEvent) => {
      if (!phonesMenuRef.current) return;
      const target = event.target as Node;
      if (!phonesMenuRef.current.contains(target)) {
        setIsPhonesOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsidePress);
    document.addEventListener('touchstart', handleOutsidePress);

    return () => {
      document.removeEventListener('mousedown', handleOutsidePress);
      document.removeEventListener('touchstart', handleOutsidePress);
    };
  }, [isPhonesOpen]);

  useEffect(() => {
    if (!isMounted) return;
    document.body.style.overflow = isFeedbackOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFeedbackOpen, isMounted]);

  const handleFeedbackSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = feedbackName.trim();
    const phone = feedbackPhone.trim();
    const email = feedbackEmail.trim();
    const message = feedbackMessage.trim();

    if (!name || !isValidPhone(phone) || !isValidEmail(email) || message.length < MIN_MESSAGE_LENGTH) return;
    if (!isValidAttachment(feedbackAttachment)) {
      setFeedbackSuccess('Файл має бути до 10MB і в дозволеному форматі.');
      return;
    }

    let uploadedAttachment: {
      fileName: string;
      fileSize: number;
      fileType: string;
      lastModified: number;
      url?: string;
    } | null = null;

    if (feedbackAttachment) {
      const uploaded = await uploadRequestAttachment(feedbackAttachment, {
        folder: 'forms/header-feedback'
      });
      uploadedAttachment = {
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        fileType: uploaded.fileType,
        lastModified: uploaded.lastModified,
        url: uploaded.url
      };
    }

    const payload = {
      fullName: name.slice(0, 80),
      phone: phone.slice(0, 30),
      email: email.slice(0, 120),
      message: message.slice(0, 1000),
      attachment: uploadedAttachment,
      sourcePage: pathname ?? '/'
    };

    try {
      setFeedbackSubmitting(true);
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Не вдалося зберегти звернення.');
      }

      trackAnalyticsEvent('form_submit', {
        form_name: 'header_feedback',
        form_type: 'feedback',
        has_attachment: Boolean(feedbackAttachment),
        page_path: pathname ?? '/'
      });

      setFeedbackSuccess('Дякуємо! Ваше повідомлення надіслано.');
      setFeedbackName('');
      setFeedbackPhone('');
      setFeedbackEmail('');
      setFeedbackMessage('');
      setFeedbackAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (submitError) {
      setFeedbackSuccess(submitError instanceof Error ? submitError.message : 'Не вдалося зберегти звернення. Спробуйте ще раз.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const primaryPhone = contactPhones[0] || defaultSiteProfileSettings.contactPhones[0];

  const renderDesktopMenuItem = (item: MenuItem) => {
    if (item.children && item.children.length > 0) {
      return (
        <div
          key={item.label}
          className="relative"
          onMouseEnter={() => setOpenMenuLabel(item.label)}
          onMouseLeave={() => setOpenMenuLabel((prev) => (prev === item.label ? null : prev))}
        >
          <button
            type="button"
            onClick={() => setOpenMenuLabel((prev) => (prev === item.label ? null : item.label))}
            aria-expanded={openMenuLabel === item.label}
            aria-haspopup="menu"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand"
          >
            {item.label}
          </button>

          <div
            className={`absolute left-0 top-12 z-[140] w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg transition-all duration-200 ${
              openMenuLabel === item.label ? 'visible opacity-100' : 'invisible opacity-0'
            }`}
          >
            <ul className="space-y-1">
              {item.children.map((subItem) => (
                <li key={subItem.label}>
                  <Link
                    href={subItem.href}
                    onClick={() => setOpenMenuLabel(null)}
                    className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-brand"
                  >
                    {subItem.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    return (
      <Link
        key={item.label}
        href={item.href}
        onClick={() => setOpenMenuLabel(null)}
        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand"
      >
        {item.label}
      </Link>
    );
  };

  const renderMobileMenuItem = (item: MenuItem) => {
    if (item.children && item.children.length > 0) {
      const isOpen = openMobileMenuLabel === item.label;

      return (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setOpenMobileMenuLabel((prev) => (prev === item.label ? null : item.label))}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold text-slate-800"
          >
            <span>{item.label}</span>
            <span className="text-xs text-slate-500">{isOpen ? '▲' : '▼'}</span>
          </button>

          {isOpen ? (
            <ul className="space-y-1 border-t border-slate-100 p-2">
              {item.children.map((subItem) => (
                <li key={subItem.label}>
                  <Link
                    href={subItem.href}
                    onClick={() => {
                      setOpenMobileMenuLabel(null);
                      setIsMobileMenuOpen(false);
                    }}
                    className="block rounded-lg px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-brand"
                  >
                    {subItem.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }

    return (
      <Link
        key={item.label}
        href={item.href}
        onClick={() => setIsMobileMenuOpen(false)}
        className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
      >
        {item.label}
      </Link>
    );
  };

  const feedbackModal = isFeedbackOpen ? (
    <div className="fixed inset-0 z-[220] bg-slate-900/45 p-4" onClick={() => setIsFeedbackOpen(false)}>
      <div
        className="mx-auto mt-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:mt-10 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 sm:text-2xl">Зворотний зв’язок</h2>
            <p className="mt-1 text-sm text-slate-600">Залиште контакти, і ми передзвонимо вам.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsFeedbackOpen(false)}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
          >
            Закрити
          </button>
        </div>

        <form onSubmit={handleFeedbackSubmit} className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1 sm:max-h-[72vh]">
          <div>
            <label htmlFor="feedback-name" className="block text-sm font-semibold text-slate-900">
              Ім’я <span className="text-red-600">*</span>
            </label>
            <input
              id="feedback-name"
              value={feedbackName}
              onChange={(e) => setFeedbackName(e.target.value)}
              maxLength={80}
              required
              placeholder="Ваше ім’я"
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            />
          </div>

          <div>
            <label htmlFor="feedback-phone" className="block text-sm font-semibold text-slate-900">
              Телефон <span className="text-red-600">*</span>
            </label>
            <input
              id="feedback-phone"
              value={feedbackPhone}
              onChange={(e) => setFeedbackPhone(normalizePhoneInput(e.target.value))}
              maxLength={30}
              inputMode="tel"
              required
              placeholder="+38 (0XX) XXX-XX-XX"
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            />
            {feedbackPhoneInvalid ? (
              <p className="mt-1 text-xs font-semibold text-red-600">Номер має містити від 10 до 15 цифр.</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="feedback-email" className="block text-sm font-semibold text-slate-900">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              id="feedback-email"
              type="email"
              value={feedbackEmail}
              onChange={(e) => setFeedbackEmail(e.target.value)}
              maxLength={120}
              required
              placeholder="name@example.com"
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            />
            {feedbackEmailInvalid ? (
              <p className="mt-1 text-xs font-semibold text-red-600">Вкажіть email у форматі name@example.com.</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="feedback-message" className="block text-sm font-semibold text-slate-900">
              Повідомлення <span className="text-red-600">*</span>
            </label>
            <textarea
              id="feedback-message"
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              rows={4}
              minLength={MIN_MESSAGE_LENGTH}
              maxLength={1000}
              required
              placeholder="Коротко опишіть ваше питання..."
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
            />
          </div>

          <div>
            <label htmlFor="feedback-file" className="block text-sm font-semibold text-slate-900">
              Фото або файл (необов’язково)
            </label>
            <input
              id="feedback-file"
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={(e) => setFeedbackAttachment(e.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-semibold file:text-brand hover:file:bg-brand/20"
            />
            {feedbackAttachment ? (
              <p className="mt-1.5 text-xs text-slate-500">
                Додано: {feedbackAttachment.name} ({Math.max(1, Math.round(feedbackAttachment.size / 1024))} KB)
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {feedbackMessage.length}/1000 (мінімум {MIN_MESSAGE_LENGTH})
            </p>
            <button
              type="submit"
              disabled={
                feedbackSubmitting ||
                feedbackName.trim().length === 0 ||
                feedbackPhoneInvalid ||
                feedbackEmailInvalid ||
                !isValidAttachment(feedbackAttachment) ||
                feedbackMessage.trim().length < MIN_MESSAGE_LENGTH
              }
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {feedbackSubmitting ? 'Надсилання...' : 'Надіслати'}
            </button>
          </div>

          {feedbackSuccess ? (
            <p className="rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-sm font-semibold text-brand">
              {feedbackSuccess}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
    <header className="relative z-[120] border-b border-brand/20 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 lg:px-8">
        <nav className="relative z-[130] rounded-2xl border border-brand/30 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 sm:gap-4">
            <Link href="/" className="flex items-center">
              <Image src={logoUrl} alt="Pchilka Market" width={160} height={52} priority className="h-9 w-auto sm:h-10" />
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative" ref={phonesMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsPhonesOpen((prev) => !prev)}
                  aria-expanded={isPhonesOpen}
                  aria-haspopup="listbox"
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-brand hover:text-brand sm:px-3 sm:py-2 sm:text-xs lg:text-sm"
                >
                  <span className="hidden sm:inline">{primaryPhone}</span>
                  <span className="sm:hidden">Тел.</span>
                </button>

                <div
                  className={`absolute right-0 top-12 z-[160] min-w-[220px] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg transition-all duration-200 ${
                    isPhonesOpen ? 'visible opacity-100' : 'invisible opacity-0'
                  }`}
                >
                  <ul className="space-y-1" role="listbox" aria-label="Контактні телефони">
                    {contactPhones.map((phone) => (
                      <li key={phone}>
                        <a
                          href={`tel:${toTel(phone)}`}
                          onClick={() => {
                            trackAnalyticsEvent('contact_phone_click', {
                              phone_label: phone,
                              page_path: pathname ?? '/'
                            });
                          }}
                          className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-brand"
                          title="Зателефонувати"
                        >
                          {phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFeedbackSuccess('');
                  setIsFeedbackOpen(true);
                  trackAnalyticsEvent('feedback_open', { page_path: pathname ?? '/' });
                }}
                className="rounded-full bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 sm:px-4 sm:text-sm"
              >
                <span className="hidden sm:inline">Зворотний зв’язок</span>
                <span className="sm:hidden">Зв’язок</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-expanded={isMobileMenuOpen}
                aria-label="Відкрити меню"
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand lg:hidden"
              >
                {isMobileMenuOpen ? 'Закрити' : 'Меню'}
              </button>
            </div>
          </div>

          <div className="mt-3 hidden flex-wrap items-center gap-3 lg:flex">{mainMenu.map(renderDesktopMenuItem)}</div>

          {isMobileMenuOpen ? (
            <div className="mt-3 space-y-2 lg:hidden">{mainMenu.map(renderMobileMenuItem)}</div>
          ) : null}
        </nav>
      </div>

    </header>
    {isMounted ? createPortal(feedbackModal, document.body) : null}
    </>
  );
}
