import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getCategoryContentTypes, type BlogCategory } from '@/lib/blog-categories';
import { normalizeSlug } from '@/lib/content-entries';
import type { ContentEntry } from '@/lib/content-entries';
import { getBlogContentFromDb, saveBlogContentToDb } from '@/lib/blog-content-repository';

export const runtime = 'nodejs';

function validateEntries(entries: ContentEntry[]): string | null {
  const slugByType = new Set<string>();

  for (const entry of entries) {
    const title = String(entry.title ?? '').trim();
    const excerpt = String(entry.excerpt ?? '').trim();
    const body = String(entry.body ?? '').trim();
    const slug = normalizeSlug(String(entry.slug ?? '').trim());
    const coverImage = String(entry.coverImage ?? '').trim();

    if (!title) return 'У статті відсутній заголовок.';
    if (!slug) return 'У статті відсутній slug.';
    if (!excerpt) return 'У статті відсутній короткий опис.';
    if (!body) return 'У статті відсутній основний текст.';
    if (!coverImage) return "У статті відсутнє cover image.";

    const key = `${entry.contentType}:${slug}`;
    if (slugByType.has(key)) {
      return `Дублікат slug "${slug}" у блоці ${entry.contentType}.`;
    }
    slugByType.add(key);
  }

  return null;
}

function validateCategories(categories: BlogCategory[]): string | null {
  const slugByType = new Set<string>();

  for (const category of categories) {
    const name = String(category.name ?? '').trim();
    const slug = normalizeSlug(String(category.slug ?? '').trim());

    if (!name) return 'У категорії відсутня назва.';
    if (!slug) return 'У категорії відсутній slug.';

    const types = getCategoryContentTypes(category);
    if (types.length === 0) return 'У категорії має бути обрано хоча б один блок контенту.';

    for (const type of types) {
      const key = `${type}:${slug}`;
      if (slugByType.has(key)) {
        return `Дублікат slug категорії "${slug}" у блоці ${type}.`;
      }
      slugByType.add(key);
    }
  }

  return null;
}

export async function GET() {
  try {
    const content = await getBlogContentFromDb();
    return NextResponse.json({ ok: true, ...content });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as {
      entries?: ContentEntry[];
      categories?: BlogCategory[];
    };

    const entries = Array.isArray(body?.entries) ? body.entries : [];
    const categories = Array.isArray(body?.categories) ? body.categories : [];

    const entriesError = validateEntries(entries);
    if (entriesError) {
      return NextResponse.json({ ok: false, error: entriesError }, { status: 400 });
    }

    const categoriesError = validateCategories(categories);
    if (categoriesError) {
      return NextResponse.json({ ok: false, error: categoriesError }, { status: 400 });
    }

    const saved = await saveBlogContentToDb({
      entries,
      categories
    });

    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
