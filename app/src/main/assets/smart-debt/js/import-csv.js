/**
 * مدير الديون الذكي برو SMS - Smart Debt Manager Pro SMS
 * CSV Importer & Arabic Parser
 */

const ImportCsvService = (function() {
  'use strict';

  // Parse CSV text respecting quotes and Arabic UTF-8 characters
  function parseCsvText(csvText) {
    if (!csvText) return [];

    const lines = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    // Clean BOM if present
    let cleanText = csvText;
    if (cleanText.charCodeAt(0) === 0xFEFF) {
      cleanText = cleanText.substr(1);
    }

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n in CRLF
        }
        currentRow.push(currentCell.trim());
        if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c !== '')) {
        lines.push(currentRow);
      }
    }

    return lines;
  }

  // Detect header indices automatically
  function detectColumns(headers) {
    const mapping = {
      nameIdx: -1,
      phoneIdx: -1,
      balanceIdx: -1,
      debtIdx: -1,
      paymentIdx: -1,
      notesIdx: -1
    };

    headers.forEach((h, idx) => {
      const lower = h.trim().toLowerCase();
      if (lower.includes('اسم') || lower.includes('عميل') || lower.includes('name') || lower.includes('customer')) {
        if (mapping.nameIdx === -1) mapping.nameIdx = idx;
      } else if (lower.includes('هاتف') || lower.includes('جوال') || lower.includes('تلفون') || lower.includes('phone') || lower.includes('mobile')) {
        if (mapping.phoneIdx === -1) mapping.phoneIdx = idx;
      } else if (lower.includes('رصيد') || lower.includes('balance') || lower.includes('متبقي')) {
        if (mapping.balanceIdx === -1) mapping.balanceIdx = idx;
      } else if (lower.includes('دين') || lower.includes('ديون') || lower.includes('debt') || lower.includes('له')) {
        if (mapping.debtIdx === -1) mapping.debtIdx = idx;
      } else if (lower.includes('دفع') || lower.includes('سداد') || lower.includes('payment') || lower.includes('عليه')) {
        if (mapping.paymentIdx === -1) mapping.paymentIdx = idx;
      } else if (lower.includes('ملاحظ') || lower.includes('note') || lower.includes('بيان')) {
        if (mapping.notesIdx === -1) mapping.notesIdx = idx;
      }
    });

    return mapping;
  }

  // Pre-analyze CSV file and return preview metrics
  function analyzeCsv(parsedRows, colMapping) {
    if (!parsedRows || parsedRows.length <= 1) {
      throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات.');
    }

    const dataRows = parsedRows.slice(1);
    const existingCustomers = AppDatabase.getCustomers();

    const validRows = [];
    const invalidRows = [];
    const potentialDuplicates = [];
    const flaggedNegativeBalances = [];

    dataRows.forEach((row, index) => {
      const rowIndex = index + 2; // Line number in file
      const rawName = colMapping.nameIdx >= 0 ? row[colMapping.nameIdx] : '';
      const rawPhone = colMapping.phoneIdx >= 0 ? row[colMapping.phoneIdx] : '';
      const rawBalance = colMapping.balanceIdx >= 0 ? row[colMapping.balanceIdx] : '';
      const rawDebt = colMapping.debtIdx >= 0 ? row[colMapping.debtIdx] : '';
      const rawPayment = colMapping.paymentIdx >= 0 ? row[colMapping.paymentIdx] : '';
      const notes = colMapping.notesIdx >= 0 ? row[colMapping.notesIdx] : '';

      if (!rawName || !rawName.trim()) {
        invalidRows.push({ rowIndex, reason: 'اسم العميل غير موجود' });
        return;
      }

      const name = rawName.trim();
      const phone = (rawPhone || '').trim();

      // Check duplicate
      const normPhone = ValidationService.normalizePhone(phone);
      const isDup = existingCustomers.some(ec => {
        if (normPhone && ValidationService.normalizePhone(ec.phone) === normPhone) return true;
        return ValidationService.normalizeArabicText(ec.name) === ValidationService.normalizeArabicText(name);
      });

      if (isDup) {
        potentialDuplicates.push({ rowIndex, name, phone });
      }

      // Calculate initial balance
      let balance = 0;
      if (rawBalance !== '') {
        balance = ValidationService.parseAmount(rawBalance);
      } else if (rawDebt !== '' || rawPayment !== '') {
        const d = ValidationService.parseAmount(rawDebt);
        const p = ValidationService.parseAmount(rawPayment);
        balance = d - p;
      }

      if (balance < 0) {
        flaggedNegativeBalances.push({ rowIndex, name, balance });
      }

      validRows.push({
        rowIndex,
        name,
        phone,
        notes,
        balance
      });
    });

    return {
      totalRows: dataRows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      duplicateCount: potentialDuplicates.length,
      negativeBalanceCount: flaggedNegativeBalances.length,
      validRows,
      invalidRows,
      potentialDuplicates
    };
  }

  // Execute import into Database
  function executeImport(validRows, date = null) {
    const importDate = date || ValidationService.formatDate();
    let importedCustomers = 0;
    let createdTransactions = 0;

    validRows.forEach(item => {
      // 1. Create customer
      const newCust = CustomerService.addCustomer({
        name: item.name,
        phone: item.phone,
        notes: item.notes ? `[مستورد من ملف] ${item.notes}` : 'مستورد من ملف'
      });
      importedCustomers++;

      // 2. If balance > 0, create documented Opening Balance
      if (item.balance !== 0) {
        TransactionService.recordTransaction({
          customerId: newCust.id,
          type: 'opening',
          amount: Math.abs(item.balance),
          date: importDate,
          reference: 'قيد افتتاحي مستورد',
          notes: item.balance > 0 
            ? `رصيد افتتاحي مدين موثق مستورد من ملف خارجي بقيمة ${item.balance}` 
            : `رصيد افتتاحي دائن موثق مستورد من ملف خارجي بقيمة ${Math.abs(item.balance)}`
        });
        createdTransactions++;
      }
    });

    return {
      importedCustomers,
      createdTransactions
    };
  }

  return {
    parseCsvText,
    detectColumns,
    analyzeCsv,
    executeImport
  };
})();

window.ImportCsvService = ImportCsvService;
