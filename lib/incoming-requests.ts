export const incomingRequestTypes = [
  'header_feedback',
  'cooperation_general',
  'cooperation_product',
  'cooperation_search_room',
  'cooperation_marketing_services',
  'cooperation_rental',
  'career_application'
] as const;

export type IncomingRequestType = (typeof incomingRequestTypes)[number];

export const incomingRequestStatuses = ['new', 'in_progress', 'done', 'spam'] as const;
export type IncomingRequestStatus = (typeof incomingRequestStatuses)[number];

export type IncomingRequestRecord = {
  id: string;
  requestType: IncomingRequestType;
  fullName: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  vacancy: string;
  subject: string;
  targetStore: string;
  message: string;
  metadata: Record<string, unknown> | null;
  sourcePage: string;
  status: IncomingRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type IncomingRequestCreateInput = {
  requestType: IncomingRequestType;
  fullName?: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  city?: string;
  vacancy?: string;
  subject?: string;
  targetStore?: string;
  message?: string;
  metadata?: Record<string, unknown> | null;
  sourcePage?: string;
};

export function isIncomingRequestType(value: unknown): value is IncomingRequestType {
  return typeof value === 'string' && (incomingRequestTypes as readonly string[]).includes(value);
}

export function isIncomingRequestStatus(value: unknown): value is IncomingRequestStatus {
  return typeof value === 'string' && (incomingRequestStatuses as readonly string[]).includes(value);
}

export function normalizeIncomingRequestStatus(value: unknown): IncomingRequestStatus {
  return isIncomingRequestStatus(value) ? value : 'new';
}

export function normalizeIncomingRequestInput(raw: IncomingRequestCreateInput): IncomingRequestCreateInput {
  return {
    requestType: raw.requestType,
    fullName: String(raw.fullName ?? '').trim(),
    companyName: String(raw.companyName ?? '').trim(),
    contactPerson: String(raw.contactPerson ?? '').trim(),
    phone: String(raw.phone ?? '').trim(),
    email: String(raw.email ?? '').trim(),
    city: String(raw.city ?? '').trim(),
    vacancy: String(raw.vacancy ?? '').trim(),
    subject: String(raw.subject ?? '').trim(),
    targetStore: String(raw.targetStore ?? '').trim(),
    message: String(raw.message ?? '').trim(),
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : null,
    sourcePage: String(raw.sourcePage ?? '').trim()
  };
}

