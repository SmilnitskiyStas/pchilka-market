# 053_2026-02-17_add_route_confirmation_for_store_addresses

## Дата
2026-02-17

## Що зроблено
- Для сторінки `Про мережу -> Наші магазини` додано підтвердження перед відкриттям маршруту в Google Maps.
- Створено клієнтський компонент `components/confirm-directions-link.tsx` з `window.confirm(...)`.
- На сторінці `app/about/stores/page.tsx` замінено прямі посилання адрес на `ConfirmDirectionsLink`.
- Якщо користувач натискає `Скасувати`, перехід на Google Maps не виконується.
