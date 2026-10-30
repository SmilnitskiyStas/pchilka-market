'use client';

import { useRef, useState } from 'react';
import { uploadRequestAttachment, type UploadedRequestAttachment } from '@/lib/request-attachment-client';
import type { IncomingRequestCreateInput } from '@/lib/incoming-requests';

export function useRequestSubmission() {
  const pending = useRef(false);
  const receipt = useRef<{ body: string; key: string } | null>(null);
  const upload = useRef<{ file: File; folder?: string; value: UploadedRequestAttachment } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return {
    isSubmitting,
    begin() {
      if (pending.current) return false;
      pending.current = true; setIsSubmitting(true); return true;
    },
    finish() { pending.current = false; setIsSubmitting(false); },
    succeeded() { receipt.current = null; upload.current = null; },
    async uploadAttachment(file: File, options: { folder?: string }) {
      if (upload.current?.file === file && upload.current.folder === options.folder) return upload.current.value;
      const value = await uploadRequestAttachment(file, options);
      upload.current = { file, folder: options.folder, value };
      return value;
    },
    submit(input: IncomingRequestCreateInput) {
      const body = JSON.stringify(input);
      if (receipt.current?.body !== body) {
        const key = globalThis.crypto?.randomUUID?.() ?? `form_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
        receipt.current = { body, key };
      }
      return fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': receipt.current.key }, body });
    }
  };
}
