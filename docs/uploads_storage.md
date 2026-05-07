# Структура Uploads

## Базовий принцип
- Усі нові файли зберігаються не в одному корені, а в тематичних папках.
- Формат шляху: `uploads/<domain>/<feature>/<year>/<month>/<file>`.
- Публічний доступ для адмінки/сайту: через `GET /media/...`.

## Поточні категорії
- `forms/header-feedback/...`:
  вкладення з форми зворотного звʼязку в хедері.
- `forms/cooperation/general/...`:
  форма "Запропонувати обладнання".
- `forms/cooperation/product/...`:
  форма "Запропонувати товар".
- `forms/cooperation/search-room/...`:
  форма "Шукаємо приміщення".
- `forms/cooperation/marketing-services/...`:
  форма "Маркетингові послуги".
- `forms/cooperation/rental/...`:
  форма "Оренда".
- `forms/career/application/...`:
  форма "Карʼєра".
- `admin/content/covers/...`:
  завантажені обкладинки для контент-менеджера.
- `admin/promotions/shock-price/...`:
  зображення для карток "Шок ціна".
- `admin/images/...`:
  дефолтна категорія для адмін-upload API, якщо папку не передано.

## Як розширювати
- Для API `POST /api/admin/images` передавайте `folder` у `FormData`.
- Для API `POST /api/uploads/request-attachment` передавайте `folder` у `FormData`.
- Використовуйте стабільні, короткі значення `folder` у форматі `domain/feature`.
