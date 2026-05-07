# 065_2026-02-17_stabilize_font_rendering_and_inheritance

## Дата
2026-02-17

## Що зроблено
- Проведено стабілізацію відображення шрифтів у глобальних стилях (`app/globals.css`).
- Додано параметри покращення рендерингу тексту:
  - `-webkit-font-smoothing: antialiased`;
  - `-moz-osx-font-smoothing: grayscale`;
  - `text-rendering: optimizeLegibility`.
- Додано єдине успадкування шрифту для елементів форм:
  - `button`, `input`, `textarea`, `select` -> `font: inherit`.
- Це прибирає візуальні розбіжності, коли на різних пристроях кнопки/поля використовували інший системний шрифт.
