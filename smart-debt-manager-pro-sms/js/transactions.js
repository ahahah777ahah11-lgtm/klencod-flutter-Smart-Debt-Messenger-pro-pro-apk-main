/**
 * مدير الديون الذكي برو SMS - Smart Debt Manager Pro SMS
 * Transactions Service (Debts, Payments, Opening Balances)
 */

const TransactionService = (function() {
  'use strict';

  let isProcessing = false;

  // Record a new transaction (debt or payment)
  function recordTransaction(data) {
    if (isProcessing) {
      throw new Error('جاري معالجة عملية أخرى، يرجى الانتظار لحظات.');
    }

    try {
      isProcessing = true;

      // 1. Validate Customer
      if (!data.customerId) {
        throw new Error('يرجى اختيار العميل.');
      }
      const customer = CustomerService.getCustomerById(data.customerId);
      if (!customer) {
        throw new Error('العميل المحدد غير موجود.');
      }

      // 2. Validate Type
      const validTypes = ['debt', 'payment', 'opening', 'settlement'];
      if (!validTypes.includes(data.type)) {
        throw new Error('نوع العملية غير صالح.');
      }

      // 3. Validate Amount
      if (!ValidationService.isValidAmount(data.amount)) {
        throw new Error('المبلغ يجب أن يكون رقماً موجباً وأكبر من الصفر.');
      }
      const amount = ValidationService.parseAmount(data.amount);

      // 4. Validate Overpayment Policy for Payments
      const settings = AppDatabase.getSettings();
      if (data.type === 'payment' && settings.preventOverpayment) {
        const currentBalance = customer.balance;
        if (currentBalance <= 0) {
          throw new Error(`لا يوجد رصيد مستحق على العميل "${customer.name}". الرصيد الحالي هو (${ValidationService.formatMoney(currentBalance, settings.currency)}). لا يمكن تسجيل دفعة.`);
        }
        if (amount > currentBalance) {
          throw new Error(`قيمة الدفعة (${ValidationService.formatMoney(amount, settings.currency)}) أكبر من الرصيد المستحق (${ValidationService.formatMoney(currentBalance, settings.currency)}). تم رفض العملية لمنع الأرصدة السالبة.`);
        }
      }

      // 5. Construct Transaction
      const transactions = AppDatabase.getTransactions();
      const newTx = {
        id: ValidationService.generateId('tx'),
        customerId: data.customerId,
        type: data.type,
        amount: amount,
        date: data.date || ValidationService.formatDate(),
        dueDate: data.type === 'debt' && data.dueDate ? data.dueDate.trim() : null,
        notes: (data.notes || '').trim(),
        reference: (data.reference || '').trim(),
        status: 'active',
        createdAt: new Date().toISOString()
      };

      transactions.push(newTx);
      AppDatabase.persist('transactions');

      // 6. Return new transaction + updated metrics
      const updatedMetrics = CustomerService.getCustomerMetrics(data.customerId);
      return {
        transaction: newTx,
        newBalance: updatedMetrics.balance,
        metrics: updatedMetrics
      };
    } finally {
      isProcessing = false;
    }
  }

  // Cancel transaction (safely with audit trail, never deletes silently!)
  function cancelTransaction(txId, reason = '') {
    const transactions = AppDatabase.getTransactions();
    const tx = transactions.find(t => t.id === txId);
    if (!tx) {
      throw new Error('العملية غير موجودة.');
    }
    if (tx.status === 'cancelled') {
      throw new Error('العملية ملغاة مسبقاً.');
    }

    tx.status = 'cancelled';
    tx.cancelReason = (reason || '').trim();
    tx.cancelledAt = new Date().toISOString();

    AppDatabase.persist('transactions');

    const updatedMetrics = CustomerService.getCustomerMetrics(tx.customerId);
    return {
      transaction: tx,
      newBalance: updatedMetrics.balance
    };
  }

  // Get transactions with filters
  function getTransactions(filters = {}) {
    const list = AppDatabase.getTransactions();
    const customersMap = {};
    AppDatabase.getCustomers().forEach(c => {
      customersMap[c.id] = c.name;
    });

    let filtered = list.map(tx => ({
      ...tx,
      customerName: customersMap[tx.customerId] || 'عميل غير معروف'
    }));

    if (filters.customerId) {
      filtered = filtered.filter(tx => tx.customerId === filters.customerId);
    }

    if (filters.type && filters.type !== 'all') {
      filtered = filtered.filter(tx => tx.type === filters.type);
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(tx => tx.status === filters.status);
    }

    if (filters.startDate) {
      filtered = filtered.filter(tx => tx.date >= filters.startDate);
    }

    if (filters.endDate) {
      filtered = filtered.filter(tx => tx.date <= filters.endDate);
    }

    // Sort by date desc, then by createdAt desc
    filtered.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return filtered;
  }

  return {
    recordTransaction,
    cancelTransaction,
    getTransactions
  };
})();

window.TransactionService = TransactionService;
