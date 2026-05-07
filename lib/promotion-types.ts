export type PromotionRecord = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  content: string;
  imageUrl: string;
  startsAt?: string;
  endsAt?: string;
  status: 'draft' | 'published' | 'archived';
  isWeekly: boolean;
  updatedAt: string;
};
