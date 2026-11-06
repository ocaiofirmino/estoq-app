"""Importa valores preenchidos, sem depender das fórmulas em cache do Excel."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import hashlib
import json
import re
import sys

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def read_workbook(path, literal_only=False):
    with ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in si.iter(f'{{{NS["s"]}}}t'))
                       for si in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        rels = {r.attrib['Id']: r.attrib['Target'] for r in
                ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        result = {}
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        for sheet in workbook.find('s:sheets', NS):
            target = rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            values = {}
            for cell in ET.fromstring(archive.read(target)).findall('s:sheetData/s:row/s:c', NS):
                if literal_only and cell.find('s:f', NS) is not None:
                    continue
                value = cell.find('s:v', NS)
                value = value.text if value is not None else None
                kind = cell.attrib.get('t')
                if kind == 's' and value is not None:
                    value = strings[int(value)]
                elif kind == 'inlineStr':
                    value = ''.join(t.text or '' for t in cell.iter(f'{{{NS["s"]}}}t'))
                elif value is not None and kind not in ('str', 'e'):
                    number = float(value)
                    value = int(number) if number.is_integer() else number
                if value is not None:
                    values[cell.attrib['r']] = value
            result[sheet.attrib['name']] = values
        return result


def excel_date(value):
    if not isinstance(value, (int, float)):
        raise ValueError(f'Data de visita inválida: {value!r}')
    return (datetime(1899, 12, 30) + timedelta(days=value)).date().isoformat()


def convert_counting_sheets(sheets):
    """Lê as colunas Contagem de todos os meses, sem importar saldos calculados."""
    stores = {f'PF{n:02d}': dict(id=f'PF{n:02d}', name=f'PF{n:02d}', official=True,
                               city='', buyer='', notes='') for n in range(1, 53)}
    products, visits = {}, []
    for name, cells in sheets.items():
        match = re.fullmatch(r'PF\s*(\d+)', name.strip(), re.IGNORECASE)
        if not match:
            continue
        store_id = f'PF{int(match[1]):02d}'
        stores.setdefault(store_id, dict(id=store_id, name=store_id, official=True,
                                        city='', buyer='', notes=''))
        rows = sorted(int(k[1:]) for k in cells if re.fullmatch(r'B\d+', k)
                      and int(k[1:]) >= 7 and cells.get('C' + k[1:])
                      and re.fullmatch(r'\d+', str(cells[k])))
        for row in rows:
            code = str(cells[f'B{row}'])
            product = dict(id=f'p-{code}', code=code, name=cells[f'C{row}'],
                           laboratory=cells.get(f'A{row}', ''))
            if code in products and products[code] != product:
                raise ValueError(f'Produto {code} diverge entre as abas: {name}.')
            products[code] = product
        for cell, label in cells.items():
            if not re.fullmatch(r'[A-Z]+6', cell) or not isinstance(label, str) or not label.endswith(' Contagem'):
                continue
            column = cell[:-1]
            items = [dict(productId=f'p-{cells[f"B{row}"]}', stock=cells[f'{column}{row}'])
                     for row in rows if cells.get(f'{column}{row}') is not None]
            raw_date = cells.get(f'{column}4')
            if not items and raw_date is None:
                continue
            if not items:
                raise ValueError(f'{name}, {column}4: data preenchida sem contagens.')
            date = excel_date(raw_date)
            for item in items:
                stock = item['stock']
                if isinstance(stock, bool) or not isinstance(stock, int) or not 0 <= stock <= 10000000:
                    raise ValueError(f'{name}, coluna {column}: contagem inválida {stock!r}.')
            visits.append(dict(id=f'import-{store_id}-{date}', storeId=store_id, date=date,
                               notes=f'Importada da planilha (aba {name}, coluna {column}).',
                               items=items, source='spreadsheet', countingMode='automatic',
                               spreadsheet=dict(sheet=name, column=column)))
    if not products or not visits:
        raise ValueError('Nenhuma visita com data e contagens foi encontrada na planilha.')
    return dict(schemaVersion=1, products=list(products.values()),
                stores=sorted(stores.values(), key=lambda s: s['id']), visits=visits,
                settings=dict(targetDays=30))


def convert(path):
    sheets = read_workbook(path, literal_only=True)
    if 'PRODUTOS' not in sheets:
        result = convert_counting_sheets(sheets)
        source = Path(path)
        result['source'] = dict(file=source.name, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                                importedAt=datetime.now(timezone.utc).isoformat(),
                                baseMonth=min(v['date'] for v in result['visits'])[:7])
        return result
    catalog = sheets['PRODUTOS']
    products = [dict(id=f'p-{catalog[f"B{row}"]}', code=str(catalog[f'B{row}']),
                     name=catalog[f'C{row}'], laboratory=catalog[f'A{row}'])
                for row in range(7, 53)]
    stores = {f'PF{number:02d}': dict(id=f'PF{number:02d}', name=f'PF{number:02d}',
                                   official=True, city='', buyer='', notes='')
              for number in range(1, 53)}
    visits = []
    for name, cells in sheets.items():
        if not re.fullmatch(r'PF\d+|EXTRA_PF\d+', name):
            continue
        number = int(re.search(r'\d+$', name).group())
        store_id = f'PF{number:02d}'
        stores.setdefault(store_id, dict(id=store_id, name=store_id, official=True,
                                        city='', buyer='', notes=''))
        for index, (incoming_col, stock_col) in enumerate(zip('EHKNQ', 'FILOR'), start=1):
            items = []
            for row, product in zip(range(7, 53), products):
                stock = cells.get(f'{stock_col}{row}')
                incoming = cells.get(f'{incoming_col}{row}')
                if stock is not None or incoming is not None:
                    items.append(dict(productId=product['id'], stock=stock,
                                      incoming=incoming or 0, outgoing=None, adjustment=0))
            if items or cells.get(f'{stock_col}4') is not None:
                date = excel_date(cells.get(f'{stock_col}4'))
                visits.append(dict(id=f'import-{store_id}-{index}', storeId=store_id, date=date,
                                   notes='Importada da planilha original.', items=items,
                                   source='spreadsheet'))
    source = Path(path)
    return dict(schemaVersion=1, products=products, stores=sorted(stores.values(), key=lambda s: s['id']), visits=visits,
                settings=dict(targetDays=30),
                source=dict(file=source.name, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                            importedAt=datetime.now(timezone.utc).isoformat(),
                            baseMonth=excel_date(sheets['PAINEL']['B2'])[:7]))


if __name__ == '__main__':
    result = convert(sys.argv[1])
    if sys.argv[2] == '-':
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)
    output = Path(sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    stock = sum(i['stock'] or 0 for v in result['visits'] for i in v['items'])
    print(json.dumps(dict(products=len(result['products']), stores=len(result['stores']),
                          visits=len(result['visits']), totalStock=stock), ensure_ascii=False))
