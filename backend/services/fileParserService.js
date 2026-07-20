/**
 * FileParserService
 * 
 * Parses uploaded CSV and Excel files into structured data.
 * Supports automatic delimiter detection for CSV files and multi-sheet Excel files.
 * Uses ExcelJS for reliable fill-color extraction (row-level + name-cell coloring).
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.5
 */

import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { extractRowColors } from './rowColorResolver.js';
import { toISTYMD, excelMMDDToIntendedYMD, isExcelUSDateFormat } from '../utils/istDate.js';

const NEUTRAL_FILL_COLORS = new Set([
  '#FFFFFF', '#000000', '#F2F2F2', '#FAFAFA', '#F0F0F0',
]);

class FileParserService {
  /**
   * Parse uploaded file (CSV or Excel)
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} filename - Original filename
   * @param {number} [sheetIndex=0] - Sheet index for Excel files (default: 0)
   * @returns {Promise<ParsedFileResult>} - Parsed file data
   */
  async parseFile(fileBuffer, filename, sheetIndex = 0) {
    const fileType = this._getFileType(filename);
    
    if (fileType === 'csv') {
      return await this._parseCSV(fileBuffer);
    } else if (fileType === 'xlsx') {
      return await this._parseExcelXlsx(fileBuffer, sheetIndex);
    } else if (fileType === 'xls') {
      return await this._parseExcelLegacy(fileBuffer, sheetIndex);
    } else {
      throw new Error(`Unsupported file format. Supported formats: .csv, .xlsx, .xls`);
    }
  }

  /**
   * Parse CSV file with automatic delimiter detection
   * @param {Buffer} fileBuffer - CSV file content
   * @returns {Promise<ParsedFileResult>} - Parsed CSV data
   * @private
   */
  async _parseCSV(fileBuffer) {
    try {
      const csvContent = fileBuffer.toString('utf-8');
      const delimiter = this.detectDelimiter(csvContent);
      
      const parseResult = Papa.parse(csvContent, {
        delimiter: delimiter,
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim(),
      });

      if (parseResult.errors.length > 0) {
        console.warn('CSV parsing warnings:', parseResult.errors);
      }

      const filteredRows = parseResult.data.filter(row => {
        return Object.values(row).some(value => value !== '');
      });

      return {
        headers: parseResult.meta.fields || [],
        rows: filteredRows,
        totalRows: filteredRows.length,
        fileType: 'csv',
        encoding: 'utf-8'
      };
    } catch (error) {
      console.error('CSV parsing error:', error);
      throw new Error(`Failed to parse CSV file: ${error.message}`);
    }
  }

  /**
   * Parse .xlsx with ExcelJS for values + fill colors.
   * @private
   */
  async _parseExcelXlsx(fileBuffer, sheetIndex = 0) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer);

      if (workbook.worksheets.length === 0) {
        throw new Error('Excel file contains no sheets');
      }

      if (sheetIndex < 0 || sheetIndex >= workbook.worksheets.length) {
        throw new Error(`Invalid sheet index ${sheetIndex}. File has ${workbook.worksheets.length} sheet(s)`);
      }

      const worksheet = workbook.worksheets[sheetIndex];
      const sheetNames = workbook.worksheets.map(ws => ws.name);

      const headerRow = worksheet.getRow(1);
      const headers = [];
      const maxCol = Math.max(worksheet.columnCount || 0, headerRow.cellCount || 0, 20);

      for (let col = 1; col <= maxCol; col++) {
        const cell = headerRow.getCell(col);
        const value = cell.value != null ? String(cell.value).trim() : '';
        if (value) {
          headers[col - 1] = value;
        }
      }

      const filteredHeaders = headers.filter(Boolean);
      if (filteredHeaders.length === 0) {
        throw new Error('Excel sheet has no header row');
      }

      const rowsWithColors = [];

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const rowData = {};
        const cellColors = {};

        for (let col = 1; col <= headers.length; col++) {
          const header = headers[col - 1];
          if (!header) continue;

          const cell = row.getCell(col);
          const rawValue = cell.value;

          if (rawValue instanceof Date) {
            // mm-dd-yy Excel columns: swap day/month to match tracker intent (07/11 = July 11)
            rowData[header] = isExcelUSDateFormat(cell.numFmt)
              ? (excelMMDDToIntendedYMD(rawValue) || '')
              : (toISTYMD(rawValue) || '');
          } else if (rawValue != null && typeof rawValue === 'object' && rawValue.text != null) {
            rowData[header] = String(rawValue.text).trim();
          } else {
            rowData[header] = rawValue != null ? String(rawValue).trim() : '';
          }

          const fillColor = this._extractExcelJSCellColor(cell);
          if (fillColor) {
            cellColors[header] = fillColor;
          }
        }

        const hasData = Object.values(rowData).some(v => v !== '' && v != null);
        if (!hasData) return;

        const rowColors = extractRowColors(cellColors);

        rowsWithColors.push({
          ...rowData,
          __cellColors: cellColors,
          __rowColors: rowColors,
        });
      });

      return {
        headers: filteredHeaders,
        rows: rowsWithColors,
        totalRows: rowsWithColors.length,
        fileType: 'xlsx',
        sheetNames,
        encoding: 'utf-8',
      };
    } catch (error) {
      console.error('Excel (xlsx) parsing error:', error);
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Parse legacy .xls via SheetJS (limited color support).
   * @private
   */
  async _parseExcelLegacy(fileBuffer, sheetIndex = 0) {
    try {
      const workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellStyles: true,
      });

      const sheetNames = workbook.SheetNames;
      if (sheetNames.length === 0) {
        throw new Error('Excel file contains no sheets');
      }

      if (sheetIndex < 0 || sheetIndex >= sheetNames.length) {
        throw new Error(`Invalid sheet index ${sheetIndex}. File has ${sheetNames.length} sheet(s)`);
      }

      const sheetName = sheetNames[sheetIndex];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: '',
      });

      const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

      const rowsWithColors = jsonData.map((row, rowIndex) => {
        const actualRowIndex = rowIndex + 2;
        const cellColors = this._extractRowColorsSheetJS(worksheet, headers, actualRowIndex);
        const rowColors = extractRowColors(cellColors);

        return {
          ...row,
          __cellColors: cellColors,
          __rowColors: rowColors,
        };
      });

      const filteredRows = rowsWithColors.filter(row => {
        return Object.entries(row).some(([key, value]) =>
          !key.startsWith('__') && value !== '' && value !== undefined
        );
      });

      return {
        headers,
        rows: filteredRows,
        totalRows: filteredRows.length,
        fileType: 'xls',
        sheetNames,
        encoding: 'utf-8',
      };
    } catch (error) {
      console.error('Excel (xls) parsing error:', error);
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Extract fill color from an ExcelJS cell.
   * @param {import('exceljs').Cell} cell
   * @returns {string|null}
   * @private
   */
  _extractExcelJSCellColor(cell) {
    const fill = cell.fill;
    if (!fill || fill.type !== 'pattern') return null;

    const fg = fill.fgColor;
    if (!fg) return null;

    if (fg.argb) {
      let argb = String(fg.argb).toUpperCase();
      if (argb.length === 8) {
        argb = argb.substring(2);
      }
      const hex = `#${argb}`;
      if (NEUTRAL_FILL_COLORS.has(hex)) return null;
      return hex;
    }

    return null;
  }

  /**
   * Extract cell colors from a SheetJS worksheet row (legacy .xls).
   * @private
   */
  _extractRowColorsSheetJS(worksheet, headers, rowIndex) {
    const colors = {};

    headers.forEach((header, colIndex) => {
      const colLetter = XLSX.utils.encode_col(colIndex);
      const cellAddress = `${colLetter}${rowIndex}`;
      const cell = worksheet[cellAddress];

      if (cell && cell.s) {
        const fillColor = cell.s.fgColor?.rgb || cell.s.bgColor?.rgb;
        if (fillColor) {
          let hexColor = fillColor.replace(/^#/, '');
          if (hexColor.length === 8) {
            hexColor = hexColor.substring(2);
          }
          const normalized = `#${hexColor.toUpperCase()}`;
          if (!NEUTRAL_FILL_COLORS.has(normalized)) {
            colors[header] = normalized;
          }
        }
      }
    });

    return colors;
  }

  /**
   * Select and parse a specific sheet from Excel file
   * @param {Buffer} fileBuffer - Excel file content
   * @param {number} sheetIndex - Sheet index to read
   * @returns {Promise<ParsedFileResult>} - Parsed Excel data from selected sheet
   */
  async selectSheet(fileBuffer, sheetIndex) {
    return await this._parseExcelXlsx(fileBuffer, sheetIndex);
  }

  /**
   * Detect CSV delimiter (comma, semicolon, or tab)
   * @param {string} csvContent - CSV file content as string
   * @returns {string} - Detected delimiter
   */
  detectDelimiter(csvContent) {
    const lines = csvContent.split('\n').slice(0, 5);
    const sampleText = lines.join('\n');

    const delimiters = [',', ';', '\t'];
    const counts = delimiters.map(delimiter => {
      return {
        delimiter,
        count: (sampleText.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
      };
    });

    const detected = counts.reduce((max, current) =>
      current.count > max.count ? current : max
    );

    return detected.count > 0 ? detected.delimiter : ',';
  }

  /**
   * Get file type from filename extension
   * @param {string} filename - Original filename
   * @returns {string} - File type (csv, xlsx, xls)
   * @private
   */
  _getFileType(filename) {
    const extension = filename.toLowerCase().split('.').pop();
    
    if (extension === 'csv') return 'csv';
    if (extension === 'xlsx') return 'xlsx';
    if (extension === 'xls') return 'xls';
    
    throw new Error('Unsupported file format');
  }
}

export default new FileParserService();
