// SpreadsheetML (XLSX) com células tipadas e ZIP sem compressão.
// https://learn.microsoft.com/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document
const encoder=new TextEncoder();
const spreadsheetNS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const escape=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

function columnName(index){let name='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;}
function cell(value,row,col){
  if(value===null||value===undefined||value==='')return '';
  const reference=columnName(col)+(row+1);
  if(value instanceof Date){
    if(!Number.isFinite(value.getTime()))throw new Error('Data inválida na exportação.');
    return `<c r="${reference}" s="2"><v>${value.getTime()/86400000+25569}</v></c>`;
  }
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('Quantidade inválida na exportação.');
    return `<c r="${reference}" s="${row===0?1:Number.isInteger(value)?0:3}"><v>${value}</v></c>`;
  }
  if(typeof value==='boolean')return `<c r="${reference}" t="b"><v>${value?1:0}</v></c>`;
  if(String(value).length>32767)throw new Error('Um texto ultrapassa o limite de uma célula do Excel.');
  // Strings são sempre texto, inclusive conteúdos iniciados por =, +, - ou @.
  return `<c r="${reference}" s="${row===0?1:0}" t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`;
}
function worksheet(sheet){
  const rows=sheet.rows;
  if(!Array.isArray(rows)||!rows.length||!rows[0].length)throw new Error('A planilha precisa de cabeçalhos.');
  const cols=rows.reduce((max,row)=>Math.max(max,row.length),0);
  if(rows.length>1048576||cols>16384)throw new Error('A exportação ultrapassa o limite de linhas ou colunas do Excel.');
  const range=`A1:${columnName(cols-1)}${rows.length}`;
  const widths=Array.from({length:cols},(_,c)=>{
    const width=sheet.widths?.[c]??Math.min(48,Math.max(13,...rows.slice(0,80).map(row=>String(row[c]??'').length+2)));
    return `<col min="${c+1}" max="${c+1}" width="${width}" customWidth="1"/>`;
  }).join('');
  const body=rows.map((values,r)=>`<row r="${r+1}"${r===0?' ht="30" customHeight="1"':''}>${values.map((v,c)=>cell(v,r,c)).join('')}</row>`).join('');
  return declaration+`<worksheet xmlns="${spreadsheetNS}"><dimension ref="${range}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widths}</cols><sheetData>${body}</sheetData><autoFilter ref="${range}"/></worksheet>`;
}

const styles=declaration+`<styleSheet xmlns="${spreadsheetNS}"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.00"/></numFmts><fonts count="2"><font><sz val="11"/><color rgb="FF283D35"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF327361"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const crcTable=Uint32Array.from({length:256},(_,i)=>{let n=i;for(let bit=0;bit<8;bit++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function concat(parts){const output=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){output.set(part,offset);offset+=part.length;}return output;}
function zip(files,createdAt){
  const local=[],central=[];let offset=0;
  const year=Math.max(1980,Math.min(2107,createdAt.getUTCFullYear()));
  const dosDate=((year-1980)<<9)|((createdAt.getUTCMonth()+1)<<5)|createdAt.getUTCDate();
  const dosTime=(createdAt.getUTCHours()<<11)|(createdAt.getUTCMinutes()<<5)|Math.floor(createdAt.getUTCSeconds()/2);
  for(const [filename,content] of files){
    const name=encoder.encode(filename),body=encoder.encode(content),crc=crc32(body);
    if(offset+body.length>0xffffffff)throw new Error('Arquivo grande demais para exportar.');
    const header=new Uint8Array(30+name.length),h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);
    h.setUint16(10,dosTime,true);h.setUint16(12,dosDate,true);h.setUint32(14,crc,true);
    h.setUint32(18,body.length,true);h.setUint32(22,body.length,true);h.setUint16(26,name.length,true);header.set(name,30);
    local.push(header,body);
    const directory=new Uint8Array(46+name.length),d=new DataView(directory.buffer);
    d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);
    d.setUint16(12,dosTime,true);d.setUint16(14,dosDate,true);d.setUint32(16,crc,true);
    d.setUint32(20,body.length,true);d.setUint32(24,body.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);directory.set(name,46);
    central.push(directory);offset+=header.length+body.length;
  }
  const directory=concat(central),end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);
  e.setUint32(12,directory.length,true);e.setUint32(16,offset,true);
  return concat([...local,directory,end]);
}

export const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export function createXlsx(sheets,{createdAt=new Date()}={}){
  if(!sheets.length||sheets.length>100)throw new Error('Quantidade de abas inválida.');
  if(!(createdAt instanceof Date)||!Number.isFinite(createdAt.getTime()))throw new Error('Data de exportação inválida.');
  const names=new Set();
  for(const sheet of sheets){
    if(!sheet.name||sheet.name.length>31||/[\[\]:*?/\\]/.test(sheet.name)||names.has(sheet.name.toLowerCase()))throw new Error('Nome de aba inválido ou repetido.');
    names.add(sheet.name.toLowerCase());
  }
  const relNS='http://schemas.openxmlformats.org/package/2006/relationships';
  const docRel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const overrides=[['/xl/workbook.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'],['/xl/styles.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml'],['/docProps/core.xml','application/vnd.openxmlformats-package.core-properties+xml'],['/docProps/app.xml','application/vnd.openxmlformats-officedocument.extended-properties+xml'],...sheets.map((_,i)=>[`/xl/worksheets/sheet${i+1}.xml`,'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'])];
  const files=[
    ['[Content_Types].xml',declaration+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.map(([path,type])=>`<Override PartName="${path}" ContentType="${type}"/>`).join('')}</Types>`],
    ['_rels/.rels',declaration+`<Relationships xmlns="${relNS}"><Relationship Id="rId1" Type="${docRel}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="${relNS}/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${docRel}/extended-properties" Target="docProps/app.xml"/></Relationships>`],
    ['xl/workbook.xml',declaration+`<workbook xmlns="${spreadsheetNS}" xmlns:r="${docRel}"><workbookPr date1904="0"/><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${escape(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',declaration+`<Relationships xmlns="${relNS}">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${docRel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${docRel}/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml',styles],
    ['docProps/core.xml',declaration+`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Estoq</dc:creator><cp:lastModifiedBy>Estoq</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${createdAt.toISOString()}</dcterms:created></cp:coreProperties>`],
    ['docProps/app.xml',declaration+'<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Estoq</Application></Properties>'],
    ...sheets.map((sheet,i)=>[`xl/worksheets/sheet${i+1}.xml`,worksheet(sheet)]),
  ];
  return zip(files,createdAt);
}
