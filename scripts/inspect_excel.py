"""Inspect cấu trúc file Excel VBQPPL - output ra file"""
import openpyxl

wb = openpyxl.load_workbook('Docs/2026-Theo Doi Tien Do Ban Hanh VBQPPL.xlsx', data_only=True)

output = []

for sheet_name in ['NQ can xu ly']:
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    
    output.append(f"=== SHEET: {sheet_name} ===")
    output.append(f"Total rows: {len(rows)}")
    output.append("")
    
    output.append("HEADER ROW 1:")
    for i, c in enumerate(rows[0]):
        if c is not None:
            output.append(f"  col[{i}] = {str(c)[:100]}")
    
    output.append("")
    output.append("HEADER ROW 2 (sub-header):")
    for i, c in enumerate(rows[1]):
        if c is not None:
            output.append(f"  col[{i}] = {str(c)[:100]}")
    
    output.append("")
    output.append("DATA ROW 3 (first data row):")
    for i, c in enumerate(rows[2]):
        output.append(f"  col[{i}] = {repr(c)[:100]}")
    
    output.append("")
    output.append("DATA ROW 4:")
    for i, c in enumerate(rows[3]):
        output.append(f"  col[{i}] = {repr(c)[:100]}")
    
    output.append("")
    output.append("DATA ROW 5:")
    for i, c in enumerate(rows[4]):
        output.append(f"  col[{i}] = {repr(c)[:100]}")
    
    output.append("")
    output.append("DATA ROW 6:")
    for i, c in enumerate(rows[5]):
        output.append(f"  col[{i}] = {repr(c)[:100]}")

with open('scripts/excel_inspect_output.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("Done! Check scripts/excel_inspect_output.txt")
