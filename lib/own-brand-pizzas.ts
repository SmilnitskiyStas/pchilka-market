import { promises as fs } from 'fs';
import path from 'path';

export type OwnBrandPizzaRecord = {
  id: string;
  name: string;
  weight: string;
  ingredients: string;
  imageUrl: string;
  bju: string;
  calories: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type OwnBrandPizzaInput = Partial<OwnBrandPizzaRecord> & {
  name?: string;
};

const ownBrandPizzasFilePath = path.join(process.cwd(), 'content', 'own-brand-pizzas.json');
const legacyPizzaListFilePath = path.join(process.cwd(), 'public', 'img', 'own_brand', 'pizza_and_coffee', 'pizza_list.txt');

function toAbsoluteWordPressUrl(src: string) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/')) return `https://pchilka-market.ua${src}`;
  return `https://pchilka-market.ua/${src}`;
}

function stripHtml(input: string) {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createPizzaId() {
  return `pizza_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeOwnBrandPizzaRecord(input: OwnBrandPizzaInput, index = 0): OwnBrandPizzaRecord {
  const now = new Date().toISOString();
  return {
    id: String(input.id ?? '').trim() || createPizzaId(),
    name: String(input.name ?? '').trim(),
    weight: String(input.weight ?? '').trim(),
    ingredients: String(input.ingredients ?? '').trim(),
    imageUrl: String(input.imageUrl ?? '').trim(),
    bju: String(input.bju ?? '').trim(),
    calories: String(input.calories ?? '').trim(),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : index,
    isActive: input.isActive !== false,
    createdAt: String(input.createdAt ?? '').trim() || now,
    updatedAt: now
  };
}

async function readOwnBrandPizzasFromFile() {
  try {
    const raw = await fs.readFile(ownBrandPizzasFilePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed
      .map((item, index) => normalizeOwnBrandPizzaRecord((item ?? {}) as OwnBrandPizzaInput, index))
      .filter((item) => item.name);
  } catch {
    return null;
  }
}

async function readLegacyOwnBrandPizzas(): Promise<OwnBrandPizzaRecord[]> {
  try {
    const raw = await fs.readFile(legacyPizzaListFilePath, 'utf8');
    const chunks = raw.split('<div class="single_pizza">').slice(1);

    return chunks
      .map((chunk, index): OwnBrandPizzaRecord | null => {
        const imageMatch = chunk.match(/<img[^>]*src="([^"]+)"/i);
        const h3Match = chunk.match(/<h3>([\s\S]*?)<\/h3>/i);
        const pMatch = chunk.match(/<p>([\s\S]*?)<\/p>/i);

        const h3Raw = h3Match ? h3Match[1] : '';
        const weightMatch = h3Raw.match(/<span>([\s\S]*?)<\/span>/i);
        const weight = weightMatch ? stripHtml(weightMatch[1]) : '';
        const name = stripHtml(h3Raw.replace(/<span>[\s\S]*?<\/span>/i, ''));

        if (!name) {
          return null;
        }

        const ingredients = stripHtml(pMatch ? pMatch[1] : '').replace(/^Склад:\s*/i, '').trim();
        const imageUrl = toAbsoluteWordPressUrl(imageMatch ? imageMatch[1].trim() : '');

        return normalizeOwnBrandPizzaRecord(
          {
            id: `legacy_pizza_${index + 1}`,
            name,
            weight,
            ingredients,
            imageUrl,
            isActive: true,
            sortOrder: index
          },
          index
        );
      })
      .filter((item): item is OwnBrandPizzaRecord => item !== null);
  } catch {
    return [];
  }
}

export async function listOwnBrandPizzas() {
  const savedItems = await readOwnBrandPizzasFromFile();
  const items = savedItems ?? (await readLegacyOwnBrandPizzas());

  return items.sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name, 'uk');
  });
}

export async function saveOwnBrandPizzas(items: OwnBrandPizzaInput[]) {
  const normalized = items
    .map((item, index) => normalizeOwnBrandPizzaRecord(item, index))
    .filter((item) => item.name)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  await fs.mkdir(path.dirname(ownBrandPizzasFilePath), { recursive: true });
  await fs.writeFile(ownBrandPizzasFilePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');

  return normalized;
}
