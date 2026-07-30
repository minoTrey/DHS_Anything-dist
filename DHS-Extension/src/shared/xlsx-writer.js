(function exposeXlsxWriter(globalScope) {
  // Minimal .xlsx writer with NO external dependencies (MV3-safe). Produces a valid OOXML workbook as a
  // STORED (uncompressed) ZIP so Excel/Numbers/Google Sheets open it as a real spreadsheet — unlike CSV,
  // which the user reported "정리가 잘 안돼" (columns/encoding not cleanly organized). Values are written
  // as inline strings so every cell keeps its exact text (leading zeros in 동/호, etc.).

  const CRC_TABLE = (() => {
    const table = new Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8Bytes(text) {
    return new TextEncoder().encode(String(text == null ? '' : text));
  }

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // strip control chars illegal in XML 1.0 (keep tab, newline, carriage-return)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  }

  function columnName(index) {
    let dividend = index + 1;
    let name = '';
    while (dividend > 0) {
      const modulo = (dividend - 1) % 26;
      name = String.fromCharCode(65 + modulo) + name;
      dividend = Math.floor((dividend - modulo) / 26);
    }
    return name;
  }

  // Auto-fit column widths from content. CJK glyphs are ~1.8x wide, so weight them; clamp to a readable band.
  function colWidthsFromRows(rows, colCount) {
    const w = new Array(colCount).fill(6);
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      (Array.isArray(row) ? row : []).forEach((v, c) => {
        if (c >= colCount) return;
        const s = String(v == null ? '' : v);
        let len = 0;
        for (let i = 0; i < s.length; i += 1) len += (s.charCodeAt(i) > 0x2E7F ? 1.8 : 1.05);
        if (len + 2.5 > w[c]) w[c] = len + 2.5;
      });
    });
    return w.map((x) => Math.min(46, Math.max(6, Math.round(x * 10) / 10)));
  }

  // Styled worksheet: frozen header row, per-column auto width, header row uses style 1 (bold/filled/centered),
  // body cells use style 2 (bordered, left+middle, wrap), plus an auto-filter over the whole table.
  function sheetXml(rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const colCount = safeRows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 1);
    const widths = colWidthsFromRows(safeRows, colCount);
    const cols = '<cols>' + widths.map((width, i) =>
      `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('') + '</cols>';
    const rowXml = safeRows.map((row, rowIndex) => {
      const isHeader = rowIndex === 0;
      const style = isHeader ? 1 : 2;
      const cells = (Array.isArray(row) ? row : []).map((value, colIndex) => {
        const ref = `${columnName(colIndex)}${rowIndex + 1}`;
        return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
      }).join('');
      const ht = isHeader ? ' ht="26" customHeight="1"' : '';
      return `<row r="${rowIndex + 1}"${ht}>${cells}</row>`;
    }).join('');
    const lastCol = columnName(Math.max(0, colCount - 1));
    const nRows = safeRows.length || 1;
    const views = '<sheetViews><sheetView workbookViewId="0">'
      + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
      + '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>';
    const fmt = '<sheetFormatPr defaultRowHeight="18"/>';
    const filter = safeRows.length > 1 ? `<autoFilter ref="A1:${lastCol}${nRows}"/>` : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + views + fmt + cols
      + `<sheetData>${rowXml}</sheetData>${filter}</worksheet>`;
  }

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2">'
    + '<font><sz val="10"/><name val="맑은 고딕"/></font>'
    + '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font>'
    + '</fonts>'
    + '<fills count="3">'
    + '<fill><patternFill patternType="none"/></fill>'
    + '<fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FF305496"/><bgColor indexed="64"/></patternFill></fill>'
    + '</fills>'
    + '<borders count="2">'
    + '<border><left/><right/><top/><bottom/><diagonal/></border>'
    + '<border>'
    + '<left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right>'
    + '<top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/>'
    + '</border>'
    + '</borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="3">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>'
    + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';

  const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>';

  const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';

  const WORKBOOK_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>';

  function workbookXml(sheetName) {
    const safeName = escapeXml(String(sheetName || 'Sheet1').slice(0, 31).replace(/[\\/?*\[\]:]/g, ' ')) || 'Sheet1';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
      + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + `<sheets><sheet name="${safeName}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  }

  // Build a STORED (method 0) ZIP from [{name, bytes}] entries.
  function zipStored(entries) {
    const encoder = entries.map((entry) => {
      const nameBytes = utf8Bytes(entry.name);
      return { nameBytes, data: entry.bytes, crc: crc32(entry.bytes) };
    });
    const chunks = [];
    const central = [];
    let offset = 0;

    const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
    const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

    for (const e of encoder) {
      const localHeader = [].concat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(e.crc), u32(e.data.length), u32(e.data.length),
        u16(e.nameBytes.length), u16(0)
      );
      chunks.push(new Uint8Array(localHeader));
      chunks.push(e.nameBytes);
      chunks.push(e.data);
      const centralHeader = [].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(e.crc), u32(e.data.length), u32(e.data.length),
        u16(e.nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
        u32(offset)
      );
      central.push({ header: new Uint8Array(centralHeader), nameBytes: e.nameBytes });
      offset += localHeader.length + e.nameBytes.length + e.data.length;
    }

    const centralStart = offset;
    let centralSize = 0;
    for (const c of central) {
      chunks.push(c.header);
      chunks.push(c.nameBytes);
      centralSize += c.header.length + c.nameBytes.length;
    }
    const eocd = [].concat(
      u32(0x06054b50), u16(0), u16(0),
      u16(central.length), u16(central.length),
      u32(centralSize), u32(centralStart), u16(0)
    );
    chunks.push(new Uint8Array(eocd));

    let total = 0;
    for (const chunk of chunks) total += chunk.length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) { out.set(chunk, pos); pos += chunk.length; }
    return out;
  }

  function base64FromBytes(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return (typeof btoa === 'function') ? btoa(binary) : Buffer.from(bytes).toString('base64');
  }

  // rows: array of arrays of cell values (strings/numbers). Returns { bytes, base64 }.
  function buildXlsx(rows, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const safeRows = Array.isArray(rows) ? rows : [];
    const entries = [
      { name: '[Content_Types].xml', bytes: utf8Bytes(CONTENT_TYPES) },
      { name: '_rels/.rels', bytes: utf8Bytes(ROOT_RELS) },
      { name: 'xl/workbook.xml', bytes: utf8Bytes(workbookXml(opts.sheetName)) },
      { name: 'xl/_rels/workbook.xml.rels', bytes: utf8Bytes(WORKBOOK_RELS) },
      { name: 'xl/styles.xml', bytes: utf8Bytes(STYLES) },
      { name: 'xl/worksheets/sheet1.xml', bytes: utf8Bytes(sheetXml(safeRows)) }
    ];
    const bytes = zipStored(entries);
    return { bytes, base64: base64FromBytes(bytes) };
  }

  const api = { buildXlsx, crc32, escapeXml, columnName };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  globalScope.DHS_XLSX_WRITER = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
