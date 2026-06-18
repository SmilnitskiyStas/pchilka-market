-- Fix previously stored mojibake text in expiry task titles and notes.
-- Safe to run more than once; it only touches rows that still contain the broken labels.

UPDATE expiry_tasks
SET
  title = REPLACE(title, 'РџРµСЂРµРІС–СЂРёС‚Рё С‚РѕРІР°СЂ', 'Перевірити товар'),
  note = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(note, 'РџР°СЂС‚С–СЏ', 'Партія'),
        'РєРѕРґ',
        'код'
      ),
      'Р·Р°Р»РёС€РѕРє',
      'залишок'
    ),
    'СЃС‚СЂРѕРє',
    'строк'
  )
WHERE title LIKE '%РџРµСЂРµРІС–СЂРёС‚Рё С‚РѕРІР°СЂ%'
   OR note LIKE '%РџР°СЂС‚С–СЏ%'
   OR note LIKE '%РєРѕРґ%'
   OR note LIKE '%Р·Р°Р»РёС€РѕРє%'
   OR note LIKE '%СЃС‚СЂРѕРє%';
