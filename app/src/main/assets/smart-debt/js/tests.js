/**
 * مدير الديون الذكي برو SMS - Smart Debt Manager Pro SMS
 * Accounting & Storage Automated Test Suite (اختبارات المحاسبة والتخزين)
 */

const AccountingTestSuite = (function() {
  'use strict';

  function runAllTests() {
    const results = [];

    // Save actual state to restore afterwards (sandbox protection)
    const backupState = {
      customers: JSON.parse(JSON.stringify(AppDatabase.getCustomers())),
      transactions: JSON.parse(JSON.stringify(AppDatabase.getTransactions())),
      remittances: JSON.parse(JSON.stringify(AppDatabase.getRemittances())),
      templates: JSON.parse(JSON.stringify(AppDatabase.getTemplates())),
      smsLogs: JSON.parse(JSON.stringify(AppDatabase.getSmsLogs())),
      settings: JSON.parse(JSON.stringify(AppDatabase.getSettings()))
    };

    try {
      // Clear database for clean deterministic tests
      AppDatabase.resetAll();

      // ==========================================
      // Test 1: Add Ahmed, Debt 1000, Payment 300
      // ==========================================
      (function() {
        const testName = 'الحالة 1: تسجيل دين 1000 ودفعة 300 للعميل أحمد';
        const steps = 'إضافة العميل أحمد، تسجيل دين بقيمة 1000، تسجيل دفعة بقيمة 300';
        const expected = 'إجمالي الديون = 1000، إجمالي المدفوعات = 300، الرصيد المتبقي = 700';
        let actual = '';
        let passed = false;

        try {
          const cust = CustomerService.addCustomer({ name: 'أحمد', phone: '777111222' });
          TransactionService.recordTransaction({ customerId: cust.id, type: 'debt', amount: 1000 });
          TransactionService.recordTransaction({ customerId: cust.id, type: 'payment', amount: 300 });

          const m = CustomerService.getCustomerMetrics(cust.id);
          actual = `إجمالي الديون = ${m.totalDebts}، إجمالي المدفوعات = ${m.totalPayments}، الرصيد المتبقي = ${m.balance}`;
          passed = (m.totalDebts === 1000 && m.totalPayments === 300 && m.balance === 700);
        } catch (e) {
          actual = 'خطأ غير متوقع: ' + e.message;
        }

        results.push({ id: 1, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 2: Add payment 700 -> balance becomes 0
      // ==========================================
      (function() {
        const testName = 'الحالة 2: سداد كامل الرصيد المتبقي (700)';
        const steps = 'تسجيل دفعة إضافية بقيمة 700 للعميل أحمد بعد وصول الرصيد إلى 700';
        const expected = 'إجمالي الديون = 1000، إجمالي المدفوعات = 1000، الرصيد المتبقي = 0';
        let actual = '';
        let passed = false;

        try {
          const cust = AppDatabase.getCustomers().find(c => c.name === 'أحمد');
          TransactionService.recordTransaction({ customerId: cust.id, type: 'payment', amount: 700 });

          const m = CustomerService.getCustomerMetrics(cust.id);
          actual = `إجمالي الديون = ${m.totalDebts}، إجمالي المدفوعات = ${m.totalPayments}، الرصيد المتبقي = ${m.balance}`;
          passed = (m.totalDebts === 1000 && m.totalPayments === 1000 && m.balance === 0);
        } catch (e) {
          actual = 'خطأ غير متوقع: ' + e.message;
        }

        results.push({ id: 2, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 3: Reject payment on zero balance
      // ==========================================
      (function() {
        const testName = 'الحالة 3: محاولة تسجيل دفعة بقيمة 100 بعد وصول الرصيد لصفر';
        const steps = 'محاولة تسجيل دفعة 100 للعميل أحمد ورصيده الحالي 0 مع تفعيل منع السداد الزائد';
        const expected = 'رفض العملية افتراضيًا وإظهار رسالة توضح عدم وجود رصيد مستحق';
        let actual = '';
        let passed = false;

        try {
          const cust = AppDatabase.getCustomers().find(c => c.name === 'أحمد');
          TransactionService.recordTransaction({ customerId: cust.id, type: 'payment', amount: 100 });
          actual = 'تم قبول العملية بالخطأ!';
          passed = false;
        } catch (e) {
          actual = 'تم الرفض بنجاح برسالة: ' + e.message;
          passed = e.message.includes('لا يوجد رصيد مستحق');
        }

        results.push({ id: 3, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 4: Add debt 500, edit customer name
      // ==========================================
      (function() {
        const testName = 'الحالة 4: إضافة دين وتعديل اسم العميل دون المساس بالعمليات';
        const steps = 'إضافة دين 500 ثم تعديل اسم العميل من أحمد إلى أحمد محمد علي';
        const expected = 'تظل العملية المالية موجودة، ويظل الرصيد صحيحاً (500)';
        let actual = '';
        let passed = false;

        try {
          const cust = AppDatabase.getCustomers().find(c => c.name === 'أحمد');
          TransactionService.recordTransaction({ customerId: cust.id, type: 'debt', amount: 500 });
          CustomerService.updateCustomer(cust.id, { name: 'أحمد محمد علي', phone: cust.phone, notes: 'محدث' });

          const updatedCust = CustomerService.getCustomerById(cust.id);
          const m = CustomerService.getCustomerMetrics(cust.id);
          actual = `الاسم الجديد: ${updatedCust.name}، الرصيد: ${m.balance}، العمليات: ${m.txCount}`;
          passed = (updatedCust.name === 'أحمد محمد علي' && m.balance === 500 && m.txCount === 4);
        } catch (e) {
          actual = 'خطأ غير متوقع: ' + e.message;
        }

        results.push({ id: 4, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 5: Confirm remittance 250 as payment & guard repeat
      // ==========================================
      (function() {
        const testName = 'الحالة 5: تأكيد حوالة 250 كدفعة ومنع تكرار التسجيل';
        const steps = 'تسجيل حوالة برقم مرجعي ت/8000011، تأكيدها كدفعة، ثم إعادة محاولة التأكيد';
        const expected = 'تُسجل الدفعة مرة واحدة فقط، ويتم رفض المحاولة الثانية';
        let actual = '';
        let passed = false;

        try {
          const cust = AppDatabase.getCustomers()[0];
          const remit = RemittanceService.addRemittance({
            company: 'النجم',
            reference: 'ت/8000011',
            amount: 250,
            customerId: cust.id,
            senderName: 'محمد سالم'
          });

          // Confirm first time
          const res1 = RemittanceService.confirmAsPayment(remit.id);
          
          // Attempt second time
          let secondAttemptRejected = false;
          try {
            RemittanceService.confirmAsPayment(remit.id);
          } catch (err2) {
            secondAttemptRejected = true;
          }

          const txsForRemit = AppDatabase.getTransactions().filter(t => t.reference && t.reference.includes('ت/8000011'));
          actual = `عدد الدفعات المسجلة للحوالة: ${txsForRemit.length}، تم رفض المحاولة الثانية: ${secondAttemptRejected}`;
          passed = (txsForRemit.length === 1 && secondAttemptRejected);
        } catch (e) {
          actual = 'خطأ غير متوقع: ' + e.message;
        }

        results.push({ id: 5, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 6: Import customer with opening balance 450
      // ==========================================
      (function() {
        const testName = 'الحالة 6: استيراد عميل برصيد افتتاحي 450';
        const steps = 'استيراد عميل خالد برصيد 450 دون تفاصيل ديون ومدفوعات سابقة';
        const expected = 'تسجيل قيد افتتاحي موثق بقيمة 450 دون إنشاء تاريخ ديون وهمي';
        let actual = '';
        let passed = false;

        try {
          const importData = [
            { rowIndex: 2, name: 'خالد صالح', phone: '770000000', notes: 'افتتاحي', balance: 450 }
          ];
          const res = ImportCsvService.executeImport(importData);

          const importedCust = AppDatabase.getCustomers().find(c => c.name === 'خالد صالح');
          const m = CustomerService.getCustomerMetrics(importedCust.id);
          const custTxs = AppDatabase.getTransactions().filter(t => t.customerId === importedCust.id);

          const hasOnlyOpening = custTxs.length === 1 && custTxs[0].type === 'opening';
          actual = `عدد العمليات: ${custTxs.length}، نوع العملية: ${custTxs[0] ? custTxs[0].type : 'لا يوجد'}، الرصيد: ${m.balance}`;
          passed = (hasOnlyOpening && m.balance === 450);
        } catch (e) {
          actual = 'خطأ غير متوقع: ' + e.message;
        }

        results.push({ id: 6, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 7: Export backup and restore
      // ==========================================
      (function() {
        const testName = 'الحالة 7: تصدير نسخة احتياطية واستعادتها بالكامل';
        const steps = 'تصدير بيانات الاختبار ككائن نسخة، تفريغ البيانات، ثم استعادتها وفحص التطابق';
        const expected = 'تظل بيانات العملاء والعمليات والأرصدة متوافقة تماماً';
        let actual = '';
        let passed = false;

        try {
          const preBackupCustCount = AppDatabase.getCustomers().length;
          const preBackupTxCount = AppDatabase.getTransactions().length;

          const snapshot = {
            formatVersion: '1.0.0',
            appName: 'SmartDebtManagerProSMS',
            exportedAt: new Date().toISOString(),
            customers: AppDatabase.getCustomers(),
            transactions: AppDatabase.getTransactions(),
            remittances: AppDatabase.getRemittances(),
            templates: AppDatabase.getTemplates(),
            smsLogs: AppDatabase.getSmsLogs(),
            settings: AppDatabase.getSettings()
          };

          // Reset
          AppDatabase.resetAll();

          // Restore
          BackupService.restoreBackup(snapshot, 'full');

          const postCustCount = AppDatabase.getCustomers().length;
          const postTxCount = AppDatabase.getTransactions().length;

          actual = `قبل النسخ: ${preBackupCustCount} عملاء و ${preBackupTxCount} عمليات. بعد الاستعادة: ${postCustCount} عملاء و ${postTxCount} عمليات.`;
          passed = (preBackupCustCount === postCustCount && preBackupTxCount === postTxCount && postCustCount > 0);
        } catch (e) {
          actual = 'خطأ غير متوقع: ' + e.message;
        }

        results.push({ id: 7, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 8: Duplicate Remittance Reference Rejection
      // ==========================================
      (function() {
        const testName = 'الحالة 8: اكتشاف ومنع تكرار الحوالات لنفس الشركة';
        const steps = 'تسجيل حوالة لنفس الشركة برقم مرجعي مستخدم مسبقاً (ت/8000011)';
        const expected = 'رفض تسجيل الحوالة المكررة برسالة تحذير واضحة';
        let actual = '';
        let passed = false;

        try {
          RemittanceService.addRemittance({
            company: 'النجم',
            reference: 'ت/8000011',
            amount: 500
          });
          actual = 'تم قبول الحوالة المكررة بالخطأ!';
          passed = false;
        } catch (e) {
          actual = 'تم رفض الحوالة بنجاح: ' + e.message;
          passed = e.message.includes('حوالة مكررة');
        }

        results.push({ id: 8, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 9: Corrupted Backup File Safety Protection
      // ==========================================
      (function() {
        const testName = 'الحالة 9: أمان البيانات عند محاولة استعادة ملف تالف';
        const steps = 'محاولة استعادة كائن ملف غير مكتمل لا يحتوي على إصدار أو سجل عملاء';
        const expected = 'رفض الاستعادة والحفاظ التام على البيانات الحالية دون فقدان أي سجل';
        let actual = '';
        let passed = false;

        try {
          const preCount = AppDatabase.getCustomers().length;
          let failedGracefully = false;
          try {
            BackupService.restoreBackup({ corrupt: true });
          } catch (err) {
            failedGracefully = true;
          }
          const postCount = AppDatabase.getCustomers().length;
          actual = `تم رفض الملف التالف: ${failedGracefully}، عدد العملاء بعد المحاولة: ${postCount} (كان: ${preCount})`;
          passed = (failedGracefully && preCount === postCount);
        } catch (e) {
          actual = 'خطأ غير متوقع: ' + e.message;
        }

        results.push({ id: 9, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 10: Prevention of customer hard deletion with transactions
      // ==========================================
      (function() {
        const testName = 'الحالة 10: حماية السجل المحاسبي عند محاولة حذف عميل لديه عمليات';
        const steps = 'محاولة حذف العميل خالد ولديه قيد افتتاحي';
        const expected = 'منع الحذف المباشر وعرض توجيه بالأرشفة للحفاظ على السجل المحاسبي';
        let actual = '';
        let passed = false;

        try {
          const cust = AppDatabase.getCustomers().find(c => c.name === 'خالد صالح');
          CustomerService.deleteCustomer(cust.id);
          actual = 'تم الحذف بالخطأ!';
          passed = false;
        } catch (e) {
          actual = 'تم منع الحذف بنجاح: ' + e.message;
          passed = e.message.includes('حفاظاً على سلامة السجل المحاسبي');
        }

        results.push({ id: 10, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 11: Customer Icon & Category Classification
      // ==========================================
      (function() {
        const testName = 'الحالة 11: تخصيص أيقونة العميل وتصنيفه وتصفية العملاء حسب التصنيف';
        const steps = 'إضافة عميل بأيقونة 👑 وتصنيف عميل VIP، وآخر بأيقونة 🏢 وتصنيف تاجر جملة، والتحقق من التصفية';
        const expected = 'حفظ الأيقونة والتصنيف بنجاح وإرجاع نتائج مطابقة عند التصفية';
        let actual = '';
        let passed = false;

        try {
          const vipCust = CustomerService.addCustomer({
            name: 'سالم التاجر',
            phone: '777555111',
            icon: '👑',
            category: 'عميل VIP'
          });

          const regularCust = CustomerService.addCustomer({
            name: 'فارس اليماني',
            phone: '777666222',
            icon: '🏢',
            category: 'تاجر جملة'
          });

          const vipOnly = CustomerService.getCustomers('all', '', 'balance_desc', 'عميل VIP');
          const wholesalerOnly = CustomerService.getCustomers('all', '', 'balance_desc', 'تاجر جملة');

          actual = `VIP: ${vipOnly.length} (اسم: ${vipOnly[0]?.name}, أيقونة: ${vipOnly[0]?.icon})، تاجر جملة: ${wholesalerOnly.length}`;
          passed = (vipOnly.length === 1 && vipOnly[0].icon === '👑' && wholesalerOnly.length === 1 && wholesalerOnly[0].category === 'تاجر جملة');
        } catch (e) {
          actual = 'خطأ غير متوقع: ' + e.message;
        }

        results.push({ id: 11, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 12: Record Debt with Due Date
      // ==========================================
      (function() {
        const testName = 'الحالة 12: تسجيل دين مع تحديد تاريخ استحقاق مستقبلي';
        const steps = 'تسجيل دين بقيمة 1500 وتاريخ استحقاق 2026-12-31 والتحقق من حفظ تاريخ الاستحقاق في القيد';
        const expected = 'حفظ القيد المحاسبي مع تاريخ الاستحقاق المحدد وربطه بكشف الحساب';
        let actual = '';
        let passed = false;

        try {
          const cust = AppDatabase.getCustomers()[0];
          const txRes = TransactionService.recordTransaction({
            customerId: cust.id,
            type: 'debt',
            amount: 1500,
            dueDate: '2026-12-31',
            notes: 'دين مؤجل'
          });

          const recordedTx = AppDatabase.getTransactions().find(t => t.id === txRes.transaction.id);
          actual = `القيد: ${recordedTx?.id}، المبلغ: ${recordedTx?.amount}، تاريخ الاستحقاق: ${recordedTx?.dueDate}`;
          passed = (recordedTx && recordedTx.dueDate === '2026-12-31' && recordedTx.amount === 1500);
        } catch (e) {
          actual = 'خطأ غير متوقع: ' + e.message;
        }

        results.push({ id: 12, name: testName, steps, expected, actual, passed });
      })();

      // ==========================================
      // Test 13: Smart Assistant Overdue Debts Detection
      // ==========================================
      (function() {
        const testName = 'الحالة 13: المساعد الذكي واكتشاف الديون المتجاوزة لتاريخ استحقاقها';
        const steps = 'تسجيل دين بتاريخ استحقاق قديم (2025-01-01) واختبار دالة getOverdueDebts وتنبيهات المساعد الذكي';
        const expected = 'اكتشاف الدين المتأخر بدقة، وحساب إجمالي المبالغ المستحقة المتأخرة، وإدراجه في التدقيق المحاسبي';
        let actual = '';
        let passed = false;

        try {
          const cust = AppDatabase.getCustomers()[0];
          TransactionService.recordTransaction({
            customerId: cust.id,
            type: 'debt',
            amount: 800,
            dueDate: '2025-01-01',
            notes: 'دين قديم متأخر'
          });

          // Reference date 2026-01-01
          const overdueReport = AssistantService.getOverdueDebts('2026-01-01');
          const audit = AssistantService.runAudit();
          const hasOverdueInsight = audit.some(item => item.title.includes('تنبيه: ديون متجاوزة لتاريخ الاستحقاق'));

          actual = `عدد المتأخرات: ${overdueReport.overdueCount}، إجمالي المتأخرات: ${overdueReport.overdueTotal}، ظهور التنبيه: ${hasOverdueInsight}`;
          passed = (overdueReport.overdueCount >= 1 && overdueReport.overdueTotal >= 800 && hasOverdueInsight);
        } catch (e) {
          actual = 'خطأ غير متوقع: ' + e.message;
        }

        results.push({ id: 13, name: testName, steps, expected, actual, passed });
      })();

    } finally {
      // Restore sandbox state to user's real state
      AppDatabase.setAllState(backupState);
    }

    return results;
  }

  return {
    runAllTests
  };
})();

window.AccountingTestSuite = AccountingTestSuite;
