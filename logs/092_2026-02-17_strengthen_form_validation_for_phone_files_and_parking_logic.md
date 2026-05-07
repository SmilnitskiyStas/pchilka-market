# 092_2026-02-17_strengthen_form_validation_for_phone_files_and_parking_logic

## Дата
2026-02-17

## Що зроблено
- Посилено валідацію телефонів у формах:
  - `components/cooperation-offer-form.tsx`
  - `components/cooperation-search-room-form.tsx`
  - `components/cooperation-marketing-services-form.tsx`
  - `components/cooperation-rental-form.tsx`
  - `components/career-application-form.tsx`
  - `components/site-header.tsx`
- Додано валідацію завантажених файлів (розмір до 10MB + whitelist розширень) у:
  - `components/cooperation-offer-form.tsx`
  - `components/career-application-form.tsx`
  - `components/site-header.tsx`
- Виправлено логіку паркомісць у формі `Шукаємо приміщення`:
  - при виборі `Немає` поле кількості очищається;
  - у payload не потрапляє кількість паркомісць для варіанту `Немає`.
- Оновлено `docs/project_status.md`.
