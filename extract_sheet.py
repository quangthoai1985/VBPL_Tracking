import pandas as pd
df = pd.read_excel('Docs/2026-Theo Doi Tien Do Ban Hanh VBQPPL.xlsx', sheet_name='Tong hop chung', header=None)
print("Shape", df.shape)
for i in range(min(50, len(df))):
    row = df.iloc[i].dropna().tolist()
    if row:
        print(f"Row {i}: {row}")
