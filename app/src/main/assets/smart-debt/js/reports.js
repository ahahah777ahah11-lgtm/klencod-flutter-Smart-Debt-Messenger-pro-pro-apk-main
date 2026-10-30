/**
 * مدير الديون الذكي برو SMS - Smart Debt Manager Pro SMS
 * Financial Reports & Account Statement Generator
 */

const ReportService = (function() {
  'use strict';

  // Overall financial summary for dashboard
  function getDashboardSummary(period = 'all') {
    const customers = CustomerService.getCustomers('all');
    let transactions = AppDatabase.getTransactions().filter(t => t.status !== 'cancelled');
    const remittances = AppDatabase.getRemittances();

    // Filter by period
    if (period !== 'all') {
      const dates = getPeriodDateRange(period);
      if (dates.start) {
        transactions = transactions.filter(t => t.date >= dates.start && t.date <= dates.end);
      }
    }

    let totalDebts = 0;
    let totalPayments = 0;

    for (const tx of transactions) {
      const amt = ValidationService.parseAmount(tx.amount);
      if (tx.type === 'debt' || (tx.type === 'opening' && amt >= 0)) {
        totalDebts += Math.abs(amt);
      } else if (tx.type === 'payment' || (tx.type === 'opening' && amt < 0)) {
        totalPayments += Math.abs(amt);
      }
    }

    totalDebts = Math.round(totalDebts * 100) / 100;
    totalPayments = Math.round(totalPayments * 100) / 100;
    const totalRemaining = Math.round((totalDebts - totalPayments) * 100) / 100;

    let totalCustomers = customers.length;
    let debtorsCount = 0;
    let settledCount = 0;

    for (const c of customers) {
      if (c.balance > 0) debtorsCount++;
      else if (c.balance === 0 && c.totalDebts > 0) settledCount++;
    }

    return {
      totalDebts,
      totalPayments,
      totalRemaining,
      totalCustomers,
      debtorsCount,
      settledCount,
      recentTransactions: transactions.slice(0, 10),
      recentRemittances: remittances.slice(0, 5)
    };
  }

  // Helper for period dates
  function getPeriodDateRange(period) {
    const today = new Date();
    const end = ValidationService.formatDate(today);
    let start = '';

    if (period === 'today') {
      start = end;
    } else if (period === 'week') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      start = ValidationService.formatDate(d);
    } else if (period === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      start = ValidationService.formatDate(d);
    } else if (period === 'year') {
      const d = new Date(today.getFullYear(), 0, 1);
      start = ValidationService.formatDate(d);
    }

    return { start, end };
  }

  // Generate Customer Detailed Account Statement
  function generateCustomerStatement(customerId, startDate = null, endDate = null) {
    const customer = CustomerService.getCustomerById(customerId);
    if (!customer) throw new Error('العميل غير موجود.');

    let txs = AppDatabase.getTransactions()
      .filter(t => t.customerId === customerId && t.status !== 'cancelled');

    // Chronological sorting (oldest first for running balance)
    txs.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    let runningBalance = 0;
    const statementRows = [];
    let periodDebts = 0;
    let periodPayments = 0;

    for (const tx of txs) {
      const amt = ValidationService.parseAmount(tx.amount);
      let debit = 0;
      let credit = 0;

      if (tx.type === 'debt' || (tx.type === 'opening' && amt >= 0)) {
        debit = Math.abs(amt);
        runningBalance += debit;
      } else if (tx.type === 'payment' || (tx.type === 'opening' && amt < 0)) {
        credit = Math.abs(amt);
        runningBalance -= credit;
      }

      runningBalance = Math.round(runningBalance * 100) / 100;

      // Check date bounds
      const inDateRange = (!startDate || tx.date >= startDate) && (!endDate || tx.date <= endDate);
      if (inDateRange) {
        periodDebts += debit;
        periodPayments += credit;
        statementRows.push({
          id: tx.id,
          date: tx.date,
          type: tx.type,
          typeLabel: tx.type === 'debt' ? 'دين' : (tx.type === 'payment' ? 'دفعة' : 'قيد افتتاحي'),
          debit: debit,
          credit: credit,
          balanceAfter: runningBalance,
          dueDate: tx.dueDate || null,
          reference: tx.reference || '-',
          notes: tx.notes || '-'
        });
      }
    }

    return {
      customer,
      startDate: startDate || (txs.length ? txs[0].date : ValidationService.formatDate()),
      endDate: endDate || ValidationService.formatDate(),
      periodDebts,
      periodPayments,
      finalBalance: customer.balance,
      rows: statementRows
    };
  }

  // Export any tabular data to CSV with UTF-8 BOM (proper Arabic support in Excel)
  function exportToCsv(filename, headers, rows) {
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\r\n';

    for (const row of rows) {
      const rowLine = row.map(val => {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
      csvContent += rowLine + '\r\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Native Bridge fallback or Web download
    if (window.AndroidNativeBridge && typeof window.AndroidNativeBridge.saveFile === 'function') {
      const reader = new FileReader();
      reader.onload = function() {
        const base64 = reader.result.split(',')[1];
        window.AndroidNativeBridge.saveFile(filename, base64, 'text/csv');
      };
      reader.readAsDataURL(blob);
      return;
    }

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 500);
  }

  return {
    getDashboardSummary,
    getPeriodDateRange,
    generateCustomerStatement,
    exportToCsv
  };
})();

window.ReportService = ReportService;
