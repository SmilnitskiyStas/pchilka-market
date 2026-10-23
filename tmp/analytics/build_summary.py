from copy import copy
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

root = Path(r"C:\Users\loyalty\source\PchilkaWebApp")
src = root / "tmp" / "analytics" / "normalized"
template_path = src / "Шок ціна з 01.09 по 07.09.26.xlsx"
old_path = src / "Отчет-25-31,08.xlsx"
new_path = src / "Отчет-1-7,09.xlsx"
out_path = root / "tmp" / "analytics" / "final_intermediate.xlsx"

template_wb = load_workbook(template_path, data_only=False, keep_links=False)
old_wb = load_workbook(old_path, data_only=True, keep_links=False)
new_wb = load_workbook(new_path, data_only=True, keep_links=False)
ws = template_wb["TDSheet"]
old_ws = old_wb["TDSheet"]
new_ws = new_wb["TDSheet"]

# Capture the user's completed first block as the style blueprint.
style_blueprint = {
    (row, offset): copy(ws.cell(row, 2 + offset)._style)
    for row in range(1, 43)
    for offset in range(5)
}
alignment_blueprint = {
    (row, offset): copy(ws.cell(row, 2 + offset).alignment)
    for row in range(1, 43)
    for offset in range(5)
}
number_formats = {
    (row, offset): ws.cell(row, 2 + offset).number_format
    for row in range(1, 43)
    for offset in range(5)
}
column_widths = [ws.column_dimensions[get_column_letter(2 + i)].width for i in range(5)]

# Remove the template's old merged layout and rebuild it consistently.
for merged in list(ws.merged_cells.ranges):
    ws.unmerge_cells(str(merged))

max_output_col = 71  # A + 14 blocks * 5 columns
for row in ws.iter_rows(min_row=1, max_row=42, min_col=1, max_col=max_output_col):
    for cell in row:
        cell.value = None

# Preserve the template's first-column styling and dimensions.
ws.merge_cells("A1:A3")
ws["A1"] = "Торговый центр"
ws["A1"]._style = copy(template_wb["TDSheet"]["A1"]._style)
ws.column_dimensions["A"].width = 47

# Source data rows: 38 stores in the prior period; the newer-only workshop is intentionally excluded.
stores = [old_ws.cell(r, 1).value for r in range(6, old_ws.max_row) if old_ws.cell(r, 1).value]
old_by_store = {old_ws.cell(r, 1).value: r for r in range(6, old_ws.max_row)}
new_by_store = {new_ws.cell(r, 1).value: r for r in range(6, new_ws.max_row)}

product_count = 13
group_count = 14  # 13 products + overall total

for group in range(group_count):
    out_start = 2 + group * 5
    src_start = 2 + group * 3
    out_end = out_start + 4
    start_letter = get_column_letter(out_start)
    end_letter = get_column_letter(out_end)

    for offset in range(5):
        out_col = out_start + offset
        ws.column_dimensions[get_column_letter(out_col)].width = column_widths[offset]
        for row in range(1, 43):
            ws.cell(row, out_col)._style = copy(style_blueprint[(row, offset)])
            ws.cell(row, out_col).alignment = copy(alignment_blueprint[(row, offset)])
            ws.cell(row, out_col).number_format = number_formats[(row, offset)]

    if group < product_count:
        ws.merge_cells(start_row=1, start_column=out_start, end_row=1, end_column=out_end)
        ws.merge_cells(start_row=2, start_column=out_start, end_row=2, end_column=out_end)
        ws.cell(1, out_start).value = old_ws.cell(1, src_start).value
        ws.cell(2, out_start).value = old_ws.cell(3, src_start).value
    else:
        ws.merge_cells(start_row=1, start_column=out_start, end_row=2, end_column=out_end)
        ws.cell(1, out_start).value = "Итого"

    headers = [
        "Остаток за вычетом текущих продаж",
        "К-ть продаж 25.08-31.08",
        "К-ть продаж 01.09-07.09",
        "Коєф.приросту",
        "Сумма продажи",
    ]
    for offset, header in enumerate(headers):
        ws.cell(3, out_start + offset).value = header

    for idx, store in enumerate(stores, start=4):
        old_row = old_by_store[store]
        new_row = new_by_store.get(store)
        ws.cell(idx, 1).value = store
        ws.cell(idx, out_start).value = old_ws.cell(old_row, src_start).value
        ws.cell(idx, out_start + 1).value = old_ws.cell(old_row, src_start + 1).value
        ws.cell(idx, out_start + 2).value = new_ws.cell(new_row, src_start + 1).value if new_row else None
        old_qty = f"{get_column_letter(out_start + 1)}{idx}"
        new_qty = f"{get_column_letter(out_start + 2)}{idx}"
        ws.cell(idx, out_start + 3).value = f'=IF(OR({old_qty}=0,{new_qty}=""),"",{new_qty}/{old_qty})'
        ws.cell(idx, out_start + 3).number_format = "0.00"
        ws.cell(idx, out_start + 4).value = old_ws.cell(old_row, src_start + 2).value

    total_row = 42
    for offset in (0, 1, 2, 4):
        col_letter = get_column_letter(out_start + offset)
        ws.cell(total_row, out_start + offset).value = f"=SUM({col_letter}4:{col_letter}41)"
    old_total = f"{get_column_letter(out_start + 1)}{total_row}"
    new_total = f"{get_column_letter(out_start + 2)}{total_row}"
    ws.cell(total_row, out_start + 3).value = f'=IF(OR({old_total}=0,{new_total}=""),"",{new_total}/{old_total})'
    ws.cell(total_row, out_start + 3).number_format = "0.00"

for idx, store in enumerate(stores, start=4):
    ws.cell(idx, 1).value = store
ws.cell(42, 1).value = "Итого"

# Ensure the template's row sizing, print view, and automatic Excel recalculation are retained.
for row in range(1, 43):
    if ws.row_dimensions[row].height is None:
        ws.row_dimensions[row].height = 15
ws.sheet_view.zoomScale = 40
ws.sheet_view.zoomScaleNormal = 100
ws.freeze_panes = "B4"
ws.auto_filter.ref = f"A3:{get_column_letter(max_output_col)}41"
ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.page_setup.fitToWidth = 1
ws.page_setup.fitToHeight = 0
ws.print_area = f"A1:{get_column_letter(max_output_col)}42"
template_wb.calculation.fullCalcOnLoad = True
template_wb.calculation.forceFullCalc = True
template_wb.calculation.calcMode = "auto"

template_wb.save(out_path)
print(out_path)
