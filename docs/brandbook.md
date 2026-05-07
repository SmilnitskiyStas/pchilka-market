# Брендбук сайту Pchilka Market

## 1. Призначення документа
Цей брендбук фіксує фактичну дизайн-систему сайту `PchilkaWebApp` (Next.js + Tailwind) станом на 17.02.2026.
Документ використовується як єдине джерело правил для:
- візуального стилю;
- UI-компонентів;
- форм і валідацій;
- анімацій;
- адаптивної поведінки.

## 2. Бренд-основа
- Бренд: `Pchilka Market`
- Основний стиль: чистий світлий інтерфейс з акцентом на зелений бренд-колір.
- Мова інтерфейсу: українська.
- Тон: інформативний, простий, без перевантаження декоративними ефектами.

## 3. Логотип і графіка
- Основний логотип: `public/img/logo.png`
- Основні банери: `public/img/baners/`
- Принцип використання логотипа:
- світлий фон;
- не деформувати пропорції;
- зберігати вільний простір навколо знаку не менше висоти літери `P` у логотипі.

## 4. Кольорова система

### 4.1 Брендові кольори
- `Brand Primary`: `#62A61D` (`brand`, `--color-brand`)
- `Brand Background`: `#F9FDF4` (`--color-bg`)
- `Brand Text`: `#17210F` (`--color-text`)

### 4.2 Нейтральні (Tailwind Slate)
- `slate-50`: `#F8FAFC`
- `slate-100`: `#F1F5F9`
- `slate-200`: `#E2E8F0`
- `slate-300`: `#CBD5E1`
- `slate-500`: `#64748B`
- `slate-600`: `#475569`
- `slate-700`: `#334155`
- `slate-800`: `#1E293B`
- `slate-900`: `#0F172A`

### 4.3 Семантичні
- `Error`: `#DC2626` (`red-600`)
- `White`: `#FFFFFF`
- `Black`: `#000000`

## 5. Типографіка
- Базовий шрифт: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
- Рендеринг: `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;`
- Принцип ієрархії:
- H1: `text-2xl` to `text-4xl`, `font-bold`
- H2: `text-xl` to `text-2xl`, `font-bold`/`font-semibold`
- Основний текст: `text-sm`/`text-base`, `text-slate-700`/`text-slate-800`
- Службовий текст: `text-xs`, `text-slate-500`

## 6. Сітка і адаптив
- Головні контейнери сторінок: `mx-auto min-h-screen max-w-4xl/5xl/6xl px-3|4 py-6|10`
- Брейкпоінти:
- `sm` >= 640px
- `md` >= 768px
- `lg` >= 1024px
- Базовий патерн секції:
- `rounded-3xl border border-brand/25 bg-white/95 p-4|5|8 shadow-sm`

## 7. Радіуси, тіні, бордери
- Радіуси:
- `rounded-lg` (8px)
- `rounded-xl` (12px)
- `rounded-2xl` (16px)
- `rounded-3xl` (24px)
- `rounded-full` (pill/кнопки/бейджі)
- Бордери:
- стандартний: `border-slate-200`
- інпут: `border-slate-300`
- бренд-акцент: `border-brand/25`, `border-brand/30`, `border-brand/60`
- Тіні:
- базова: `shadow-sm`
- hover-підсилення: `hover:shadow-lg`

## 8. Компонентні стандарти

### 8.1 Header і навігація
- Desktop: pill-кнопки меню з outline-стилем.
- Mobile: окреме меню-акордеон.
- CTA `Зворотний зв’язок`: `rounded-full bg-brand text-white`.
- Модальне вікно зворотного зв’язку:
- повноекранний оверлей (`fixed inset-0`, затемнення всього фону);
- блокується скрол бекграунду при відкритті.

### 8.2 Кнопки
- `Primary`: `rounded-full bg-brand text-white hover:opacity-90`
- `Secondary Outline`: `rounded-full border border-slate-300 bg-white text-slate-700 hover:border-brand hover:text-brand`
- `Link Action`: `text-brand hover:underline`
- `Disabled`: `disabled:cursor-not-allowed disabled:opacity-60`
- В усіх формах submit-кнопка вирівняна вправо (`ml-auto`).

### 8.3 Карти/картки
- Базова картка:
- `rounded-2xl border border-slate-200 bg-white p-4|5 shadow-sm`
- Інтерактивна картка:
- `transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand/60 hover:shadow-lg`
- Для іконки в картці:
- `group-hover:scale-110` (як у “Наші магазини” та “Запропонувати товар”).

### 8.4 Банер-карусель
- Автоперемикання: кожні `4000ms`.
- Fade-перехід: `duration-700`.
- Індикатори: активний `bg-brand`, неактивні білі.

## 9. Стандарти форм

### 9.1 Загальний вигляд полів
- Інпут/textarea/select:
- `w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800`
- фокус: `focus:border-brand`
- Required-поле маркується `*` у `red-600`.

### 9.2 Валідація
- Телефон:
- дозволені символи вводу: цифри + `+ ( ) -` і пробіл;
- перевірка: від `10` до `15` цифр.
- Email:
- regex-перевірка формату `name@example.com`.
- Текстові поля коментарів/повідомлень:
- мінімум `10` символів (де передбачено формою).
- Inline-помилки:
- відображаються під полем червоним текстом (`text-red-600`), а не тільки через блокування submit.

### 9.3 Файли
- Загальне обмеження: до `10MB`.
- Допустимі формати:
- Header feedback: `jpg,jpeg,png,webp,pdf,doc,docx,txt`
- Cooperation offer: + `xls,xlsx`
- Career: `pdf,doc,docx,txt,jpg,jpeg,png,webp`

### 9.4 Логіка збереження (MVP)
- Форми зберігають заявки в `localStorage` (окремий ключ на форму).
- Для сторінки “Запропонувати товар” також формується `mailto:` на email менеджера обраної категорії.

## 10. Анімації та мікроінтеракції
- Основні transition: `duration-200`/`300`.
- Hover-поведінка:
- картки піднімаються (`-translate-y-1`);
- іконки в групах збільшуються (`scale-110`);
- зображення в прев’ю злегка збільшуються (`group-hover:scale-105`).
- Flipbook-анімації:
- `bookFlipNext`/`bookFlipPrev`, дефолтна тривалість `800ms`.

## 11. Патерн сторінок розділів
- Уніфікований hero-блок розділу:
- бейдж категорії (`uppercase tracking-[0.2em] text-brand`);
- заголовок сторінки;
- опис.
- Нижче контент:
- інфо-блоки/картки;
- контакти (за потреби);
- форма взаємодії.

## 12. Контент і доступність
- Контраст: бренд-кнопки лише на світлому фоні.
- Усі активні елементи мають `hover`-стан.
- Інтерактивні контакти (`mailto`, `tel`) стилізуються як бренд-посилання.
- Для графічних елементів використовуються `alt`-описи.

## 13. Технічні токени (джерело правди)
- Tailwind-конфіг: `tailwind.config.js`
- Глобальні CSS-змінні: `app/globals.css`
- Header/Navigation і modal feedback: `components/site-header.tsx`
- Форми:
- `components/cooperation-offer-form.tsx`
- `components/cooperation-search-room-form.tsx`
- `components/cooperation-marketing-services-form.tsx`
- `components/cooperation-rental-form.tsx`
- `components/career-application-form.tsx`
- Базовий сторінковий стиль: сторінки в `app/**/page.tsx`

## 14. Правила розвитку брендбуку
- Нові UI-компоненти додавати тільки через існуючі токени кольору/радіусів/тіней.
- Нові стани кнопок і полів спочатку фіксувати в цьому документі.
- При зміні базових токенів (`brand`, типографіка, радіуси) оновлювати:
- `tailwind.config.js`
- `app/globals.css`
- `docs/brandbook.md`
