/**
 * مدير الديون الذكي برو SMS - Smart Debt Manager Pro SMS
 * Main Application Controller (UI Routing, Modals, Event Listeners)
 */

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // Initialize DB
  AppDatabase.init();
  SettingsService.applyTheme(AppDatabase.getSettings());

  // Application State
  const appState = {
    currentScreen: 'dashboard',
    activeCustomerId: null,
    historyStack: ['dashboard'],
    smsQueue: [],
    smsQueueIndex: 0,
    csvPreviewData: null,
    backupPreviewData: null
  };

  // Toast Notification System
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (container.contains(toast)) container.removeChild(toast);
      }, 300);
    }, duration);
  }

  // Navigation Router
  function navigateTo(screenId, params = {}) {
    // Hide all screens
    const screens = document.querySelectorAll('.app-screen');
    screens.forEach(s => s.classList.remove('active'));

    const target = document.getElementById('screen-' + screenId);
    if (!target) {
      console.error('Screen not found:', screenId);
      return;
    }

    target.classList.add('active');
    appState.currentScreen = screenId;
    if (params.customerId) {
      appState.activeCustomerId = params.customerId;
    }

    // Update bottom nav highlights
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      const navTarget = item.getAttribute('data-screen');
      if (navTarget === screenId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update sub nav tabs highlights
    const tabChips = document.querySelectorAll('.tab-chip');
    tabChips.forEach(chip => {
      const chipTarget = chip.getAttribute('data-screen');
      if (chipTarget === screenId) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Render screen contents
    renderScreen(screenId, params);
  }

  // Render dynamic screen contents
  function renderScreen(screenId, params) {
    switch (screenId) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'customers':
        renderCustomersList();
        break;
      case 'customer_detail':
        renderCustomerDetail(appState.activeCustomerId);
        break;
      case 'transactions':
        renderTransactionsList();
        break;
      case 'remittances':
        renderRemittancesList();
        break;
      case 'sms_management':
        renderSmsManagement();
        break;
      case 'sms_templates':
        renderSmsTemplates();
        break;
      case 'sms_logs':
        renderSmsLogs();
        break;
      case 'reports':
        renderReports();
        break;
      case 'assistant':
        renderAssistant();
        break;
      case 'settings':
        renderSettings();
        break;
      case 'about':
        renderAbout();
        break;
    }
  }

  // ==========================================
  // 1. Dashboard
  // ==========================================
  // Helper: Category badge renderer
  function getCategoryBadgeHtml(category) {
    const cat = category || 'عميل عادي';
    switch (cat) {
      case 'عميل VIP':
        return `<span class="badge badge-vip">👑 VIP</span>`;
      case 'عميل جديد':
        return `<span class="badge badge-new">🆕 جديد</span>`;
      case 'عميل متعثر':
        return `<span class="badge badge-overdue">⚠️ متعثر</span>`;
      case 'تاجر جملة':
        return `<span class="badge badge-wholesaler">🏢 جملة</span>`;
      case 'عميل تجزئة':
        return `<span class="badge badge-retail">🛒 تجزئة</span>`;
      default:
        return `<span class="badge badge-regular">${cat}</span>`;
    }
  }

  // Helper: Icon Picker renderer
  function renderIconPicker(containerId, hiddenInputId, selectedIcon) {
    const container = document.getElementById(containerId);
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!container || !hiddenInput) return;

    const settings = AppDatabase.getSettings();
    const icons = (settings && settings.availableIcons) 
      ? settings.availableIcons 
      : ['👤', '👑', '🏪', '🛒', '🏢', '💼', '⭐', '🚗', '📱', '🛠️', '🌾', '📦', '🤝', '💎', '👨‍💼', '👩‍💼'];
    const active = selectedIcon || hiddenInput.value || '👤';
    hiddenInput.value = active;

    container.innerHTML = icons.map(icon => `
      <button type="button" class="icon-picker-btn ${icon === active ? 'active' : ''}" data-icon="${icon}" onclick="App.selectIconPicker('${containerId}', '${hiddenInputId}', '${icon}')">
        ${icon}
      </button>
    `).join('');
  }

  // ==========================================
  // 1. Dashboard
  // ==========================================
  function renderDashboard() {
    const summary = ReportService.getDashboardSummary();
    const settings = AppDatabase.getSettings();
    const cur = settings.currency || 'ر.ي';

    // 1. Smart Assistant: Overdue Debts Alert Banner
    const overdueContainer = document.getElementById('dash-overdue-alert-container');
    if (overdueContainer) {
      const overdue = AssistantService.getOverdueDebts();
      if (overdue.count > 0) {
        overdueContainer.innerHTML = `
          <div class="overdue-alert-banner">
            <div class="overdue-alert-content">
              <span class="overdue-alert-icon">⏰</span>
              <div class="overdue-alert-text">
                <h4>تنبيه ذكي: لديك (${overdue.count}) ديون متجاوزة لتاريخ الاستحقاق!</h4>
                <p>إجمالي المبالغ المستحقة المتأخرة: <strong>${ValidationService.formatMoney(overdue.totalOverdueAmount, cur)}</strong> لـ ${overdue.items.length} عملاء.</p>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-danger btn-sm" onclick="App.navigateTo('sms_management')">مطالبة SMS 💬</button>
              <button class="btn btn-outline btn-sm" onclick="App.navigateTo('assistant')">التفاصيل 🧠</button>
            </div>
          </div>
        `;
      } else {
        overdueContainer.innerHTML = '';
      }
    }

    // Update numbers
    document.getElementById('dash-total-debts').textContent = ValidationService.formatMoney(summary.totalDebts, cur);
    document.getElementById('dash-total-payments').textContent = ValidationService.formatMoney(summary.totalPayments, cur);
    document.getElementById('dash-total-balance').textContent = ValidationService.formatMoney(summary.totalRemaining, cur);

    document.getElementById('dash-customers-count').textContent = summary.totalCustomers;
    document.getElementById('dash-debtors-count').textContent = summary.debtorsCount;
    document.getElementById('dash-settled-count').textContent = summary.settledCount;

    // Recent Transactions
    const recentTxsContainer = document.getElementById('dash-recent-txs');
    if (!recentTxsContainer) return;

    if (summary.recentTransactions.length === 0) {
      recentTxsContainer.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <div class="empty-icon">📝</div>
          <div class="empty-title">لا توجد عمليات مسجلة بعد</div>
          <div class="empty-desc">ابدأ بإضافة أول عميل ثم سجل الديون والمدفوعات بسهولة.</div>
          <button class="btn btn-primary btn-sm" onclick="App.openAddCustomerModal()">+ إضافة أول عميل</button>
        </div>
      `;
    } else {
      const customersMap = {};
      AppDatabase.getCustomers().forEach(c => customersMap[c.id] = c);

      recentTxsContainer.innerHTML = summary.recentTransactions.map(tx => {
        const isDebt = tx.type === 'debt' || (tx.type === 'opening' && tx.amount >= 0);
        const typeBadge = isDebt 
          ? `<span class="badge badge-debt">دين</span>` 
          : `<span class="badge badge-payment">دفعة</span>`;
        const cust = customersMap[tx.customerId];
        const cName = cust ? cust.name : 'عميل محذوف';
        const cIcon = cust ? (cust.icon || '👤') : '👤';

        return `
          <div class="tx-item" onclick="App.viewCustomer('${tx.customerId}')" style="cursor: pointer;">
            <div class="tx-info" style="display: flex; flex-direction: row; align-items: center; gap: 8px;">
              <span class="customer-avatar-icon">${cIcon}</span>
              <div>
                <div class="tx-title">${typeBadge} <strong>${cName}</strong></div>
                <div class="tx-meta">${tx.date} ${tx.dueDate ? '• ⏰ الاستحقاق: ' + tx.dueDate : ''} ${tx.reference ? '• ر/م: ' + tx.reference : ''}</div>
              </div>
            </div>
            <div class="tx-amount ${isDebt ? 'debt' : 'payment'}">
              ${isDebt ? '+' : '-'}${ValidationService.formatMoney(tx.amount, cur)}
            </div>
          </div>
        `;
      }).join('');
    }

    // Recent Remittances
    const recentRemitsContainer = document.getElementById('dash-recent-remittances');
    if (recentRemitsContainer) {
      if (summary.recentRemittances.length === 0) {
        recentRemitsContainer.innerHTML = `<p class="form-hint" style="text-align:center; padding: 10px;">لا توجد حوالات مسجلة مؤخراً.</p>`;
      } else {
        recentRemitsContainer.innerHTML = summary.recentRemittances.map(r => {
          const statusBadge = r.matchingStatus === 'recorded_as_payment'
            ? `<span class="badge badge-payment">مسجلة كدفعة</span>`
            : `<span class="badge badge-warning">بانتظار التأكيد</span>`;
          return `
            <div class="tx-item">
              <div class="tx-info">
                <div class="tx-title"><strong>${r.company}</strong> ${statusBadge}</div>
                <div class="tx-meta">المرسل: ${r.senderName || '-'} • ر/م: ${r.reference} • ${r.date}</div>
              </div>
              <div class="tx-amount payment">
                ${ValidationService.formatMoney(r.amount, cur)}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  // ==========================================
  // 2. Customers List
  // ==========================================
  function renderCustomersList() {
    const searchInput = document.getElementById('customers-search-input');
    const filterSelect = document.getElementById('customers-filter-select');
    const sortSelect = document.getElementById('customers-sort-select');
    const categorySelect = document.getElementById('customers-category-select');

    const query = searchInput ? searchInput.value : '';
    const filter = filterSelect ? filterSelect.value : 'all';
    const sort = sortSelect ? sortSelect.value : 'balance_desc';
    const category = categorySelect ? categorySelect.value : 'all';

    const customers = CustomerService.getCustomers(filter, query, sort, category);
    const container = document.getElementById('customers-list-container');
    const settings = AppDatabase.getSettings();
    const cur = settings.currency || 'ر.ي';

    if (!container) return;

    if (customers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <div class="empty-title">لا يوجد عملاء مطابقون للبحث والتصنيف</div>
          <div class="empty-desc">يمكنك إضافة عميل جديد أو تغيير معايير البحث والتصفية.</div>
          <button class="btn btn-primary" onclick="App.openAddCustomerModal()">+ إضافة عميل جديد</button>
        </div>
      `;
      return;
    }

    container.innerHTML = customers.map(c => {
      const isDebtor = c.balance > 0;
      const statusBadge = isDebtor 
        ? `<span class="badge badge-debt">مدين</span>` 
        : (c.balance === 0 ? `<span class="badge badge-settled">مسدد</span>` : `<span class="badge badge-info">دائن</span>`);

      return `
        <div class="customer-card">
          <div class="customer-card-header">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span class="customer-avatar-icon" title="أيقونة العميل">${c.icon || '👤'}</span>
              <div>
                <div class="customer-name" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span>${c.name}</span>
                  ${getCategoryBadgeHtml(c.category)}
                  ${statusBadge}
                  ${c.archived ? '<span class="badge" style="background:#64748B;color:#fff;">مؤرشف</span>' : ''}
                </div>
                <div class="customer-phone">${c.phone ? '📞 ' + c.phone : '<span style="color:#94a3b8">بدون هاتف</span>'}</div>
              </div>
            </div>
            <div class="customer-balance-box">
              <div style="font-size: 11px; color: var(--color-text-muted);">الرصيد المتبقي</div>
              <div class="customer-balance-amount ${isDebtor ? 'debt' : 'settled'}">
                ${ValidationService.formatMoney(c.balance, cur)}
              </div>
            </div>
          </div>

          <div class="customer-stats-row">
            <div class="item">
              <span class="lbl">إجمالي الديون:</span>
              <span class="val text-danger" style="color:var(--color-debt);">${ValidationService.formatMoney(c.totalDebts, cur)}</span>
            </div>
            <div class="item">
              <span class="lbl">إجمالي المسدد:</span>
              <span class="val text-success" style="color:var(--color-payment);">${ValidationService.formatMoney(c.totalPayments, cur)}</span>
            </div>
          </div>

          <div class="customer-actions-row">
            <button class="btn btn-outline btn-sm" onclick="App.viewCustomer('${c.id}')">👁️ التفاصيل والكشف</button>
            <button class="btn btn-danger btn-sm" onclick="App.openRecordDebtModal('${c.id}')">+ دين</button>
            <button class="btn btn-success btn-sm" onclick="App.openRecordPaymentModal('${c.id}')">+ دفعة</button>
            ${isDebtor ? `<button class="btn btn-primary btn-sm" onclick="App.openSendSmsModal('${c.id}')">💬 SMS</button>` : ''}
          </div>
        </div>
      `;
  }

  // ==========================================
  // 3. Customer Detail & Statement
  // ==========================================
  function renderCustomerDetail(customerId) {
    if (!customerId) {
      navigateTo('customers');
      return;
    }

    const customer = CustomerService.getCustomerById(customerId);
    if (!customer) {
      showToast('العميل غير موجود.', 'error');
      navigateTo('customers');
      return;
    }

    const settings = AppDatabase.getSettings();
    const cur = settings.currency || 'ر.ي';

    document.getElementById('detail-customer-name').innerHTML = `
      <span class="customer-avatar-icon" style="width: 36px; height: 36px; font-size: 20px; vertical-align: middle; margin-left: 8px;">${customer.icon || '👤'}</span>
      <span>${customer.name}</span>
      ${getCategoryBadgeHtml(customer.category)}
    `;
    document.getElementById('detail-customer-phone').textContent = customer.phone || 'غير مسجل';
    document.getElementById('detail-customer-notes').textContent = customer.notes || 'لا توجد ملاحظات';

    document.getElementById('detail-balance').textContent = ValidationService.formatMoney(customer.balance, cur);
    document.getElementById('detail-total-debts').textContent = ValidationService.formatMoney(customer.totalDebts, cur);
    document.getElementById('detail-total-payments').textContent = ValidationService.formatMoney(customer.totalPayments, cur);

    // Setup action buttons with current ID
    document.getElementById('btn-cust-add-debt').onclick = () => App.openRecordDebtModal(customerId);
    document.getElementById('btn-cust-add-payment').onclick = () => App.openRecordPaymentModal(customerId);
    document.getElementById('btn-cust-edit').onclick = () => App.openEditCustomerModal(customerId);
    document.getElementById('btn-cust-statement').onclick = () => App.printCustomerStatement(customerId);
    document.getElementById('btn-cust-sms').onclick = () => App.openSendSmsModal(customerId);
    document.getElementById('btn-cust-archive').onclick = () => App.toggleArchiveCustomer(customerId);
    document.getElementById('btn-cust-delete').onclick = () => App.deleteCustomer(customerId);

    // Statement / Transactions history
    const statement = ReportService.generateCustomerStatement(customerId);
    const tableBody = document.getElementById('detail-tx-table-body');
    if (!tableBody) return;

    if (statement.rows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748B;">لا توجد عمليات مسجلة لهذا العميل حتى الآن.</td></tr>`;
      return;
    }

    const todayStr = ValidationService.formatDate();
    tableBody.innerHTML = statement.rows.map(row => {
      const isDebt = row.type === 'debt' || (row.type === 'opening' && row.debit > 0);
      const isOverdue = row.dueDate && row.dueDate < todayStr && customer.balance > 0;
      return `
        <tr>
          <td>${row.date}</td>
          <td><span class="badge ${isDebt ? 'badge-debt' : 'badge-payment'}">${row.typeLabel}</span></td>
          <td class="amount text-danger" style="color:var(--color-debt);">${row.debit > 0 ? ValidationService.formatMoney(row.debit, cur) : '-'}</td>
          <td class="amount text-success" style="color:var(--color-payment);">${row.credit > 0 ? ValidationService.formatMoney(row.credit, cur) : '-'}</td>
          <td class="amount" style="font-weight:800;">${ValidationService.formatMoney(row.balanceAfter, cur)}</td>
          <td>
            ${row.notes || '-'}
            ${row.reference && row.reference !== '-' ? `<br><small style="color:#64748B">ر/م: ${row.reference}</small>` : ''}
            ${row.dueDate ? `<br><small style="color:${isOverdue ? 'var(--color-debt)' : '#0284C7'}; font-weight:700;">⏰ استحقاق: ${row.dueDate} ${isOverdue ? '<span class="badge badge-overdue" style="font-size:10px; padding:1px 5px;">متأخر ⚠️</span>' : ''}</small>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================
  // 4. Transactions List
  // ==========================================
  function renderTransactionsList() {
    const typeFilter = document.getElementById('tx-filter-type') ? document.getElementById('tx-filter-type').value : 'all';
    const txs = TransactionService.getTransactions({ type: typeFilter });
    const container = document.getElementById('tx-list-container');
    const settings = AppDatabase.getSettings();
    const cur = settings.currency || 'ر.ي';

    if (!container) return;

    if (txs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💳</div>
          <div class="empty-title">لا توجد عمليات مطابقة</div>
          <div class="empty-desc">يمكنك تسجيل دين أو دفعة جديدة من الأزرار السريعة.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = txs.map(tx => {
      const isDebt = tx.type === 'debt' || (tx.type === 'opening' && tx.amount >= 0);
      const isCancelled = tx.status === 'cancelled';

      return `
        <div class="tx-item" style="${isCancelled ? 'opacity: 0.5; background: #FFF1F2;' : ''}">
          <div class="tx-info">
            <div class="tx-title">
              <span class="badge ${isDebt ? 'badge-debt' : 'badge-payment'}">
                ${tx.type === 'debt' ? 'دين' : (tx.type === 'payment' ? 'دفعة' : 'قيد افتتاحي')}
              </span>
              <strong>${tx.customerName}</strong>
              ${isCancelled ? '<span class="badge" style="background:#EF4444;color:#fff;">ملغاة</span>' : ''}
            </div>
            <div class="tx-meta">
              📅 ${tx.date} ${tx.reference ? '• ر/م: ' + tx.reference : ''}
              ${tx.notes ? '• ' + tx.notes : ''}
            </div>
          </div>
          <div style="text-align: left;">
            <div class="tx-amount ${isDebt ? 'debt' : 'payment'}">
              ${isDebt ? '+' : '-'}${ValidationService.formatMoney(tx.amount, cur)}
            </div>
            ${!isCancelled ? `
              <button class="btn btn-outline btn-sm" style="margin-top: 4px; padding: 2px 8px; font-size: 11px; color: var(--color-debt);" onclick="App.cancelTransactionPrompt('${tx.id}')">إلغاء العملية</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // 5. Inward Remittances
  // ==========================================
  function renderRemittancesList() {
    const list = RemittanceService.getRemittances();
    const container = document.getElementById('remittances-list-container');
    const settings = AppDatabase.getSettings();
    const cur = settings.currency || 'ر.ي';

    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📨</div>
          <div class="empty-title">لا توجد حوالات واردة مسجلة</div>
          <div class="empty-desc">سجل الحوالات الواردة من شركات الصرافة واربطها بالعملاء لترحيلها كدفعات معتمدة.</div>
          <button class="btn btn-primary" onclick="App.openAddRemittanceModal()">+ تسجيل حوالة جديدة</button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(r => {
      const isRecorded = r.matchingStatus === 'recorded_as_payment';
      const statusBadge = isRecorded 
        ? `<span class="badge badge-payment">مسجلة كدفعة</span>` 
        : (r.customerId ? `<span class="badge badge-info">مطابقة لعميل</span>` : `<span class="badge badge-warning">غير مطابقة</span>`);

      return `
        <div class="card" style="margin-bottom: 12px;">
          <div class="card-header" style="margin-bottom: 8px; padding-bottom: 6px;">
            <div class="card-title" style="font-size: 14px;">
              <span>🏢 ${r.company}</span>
              ${statusBadge}
            </div>
            <div style="font-size: 16px; font-weight: 800; color: var(--color-payment);" class="amount">
              ${ValidationService.formatMoney(r.amount, cur)}
            </div>
          </div>
          <div style="font-size: 13px; color: var(--color-text-main); margin-bottom: 8px; line-height: 1.6;">
            <div><strong>المرسل:</strong> ${r.senderName || 'غير مسجل'} ${r.senderPhone ? '(' + r.senderPhone + ')' : ''}</div>
            <div><strong>الرقم المرجعي للحوالة:</strong> <span style="font-family:monospace; font-weight:700;">${r.reference}</span></div>
            <div><strong>العميل المرتبط:</strong> <span style="color:var(--color-primary-dark); font-weight:700;">${r.customerName}</span></div>
            <div><strong>تاريخ الحوالة:</strong> ${r.date} ${r.notes ? '• ' + r.notes : ''}</div>
          </div>
          <div style="display: flex; gap: 8px; justify-content: flex-end; border-top: 1px dashed var(--color-border); padding-top: 8px;">
            ${!isRecorded ? `
              <button class="btn btn-outline btn-sm" onclick="App.openLinkRemittanceModal('${r.id}')">🔗 ربط بعميل</button>
              <button class="btn btn-success btn-sm" onclick="App.confirmRemittanceAsPayment('${r.id}')">✅ تأكيد وترحيل كدفعة</button>
            ` : `
              <span style="font-size: 12px; color: #16A34A; font-weight: 700;">تم ترحيلها بنجاح للدفاتر (رقم العملية: ${r.paymentTransactionId})</span>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // 6. SMS Management
  // ==========================================
  function renderSmsManagement() {
    const debtors = CustomerService.getCustomers('debtors');
    const container = document.getElementById('sms-debtors-list-container');
    const settings = AppDatabase.getSettings();
    const cur = settings.currency || 'ر.ي';

    // Populate templates dropdown
    const tplSelect = document.getElementById('sms-template-select');
    if (tplSelect) {
      const templates = SmsService.getTemplates();
      tplSelect.innerHTML = templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }

    if (!container) return;

    if (debtors.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <div class="empty-title">لا يوجد عملاء مدينون حالياً!</div>
          <div class="empty-desc">جميع ديون العملاء مسددة بالكامل. لا حاجة لإرسال أي تذكيرات.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: #fff; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--color-border);">
        <label style="display: flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer;">
          <input type="checkbox" id="sms-select-all-checkbox" onchange="App.toggleSelectAllDebtors(this)">
          تحديد جميع العملاء المدينين (${debtors.length})
        </label>
        <button class="btn btn-primary btn-sm" onclick="App.prepareBulkSmsQueue()">تجهيز رسائل المحددين 💬</button>
      </div>
      <div class="debtors-checkbox-list">
        ${debtors.map(c => `
          <div class="customer-card" style="margin-bottom: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;">
                <input type="checkbox" class="debtor-checkbox" value="${c.id}" data-phone="${c.phone || ''}" data-name="${c.name}">
                <div>
                  <div style="font-weight: 700;">${c.name}</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); direction: ltr; display: inline-block;">
                    ${c.phone ? '📞 ' + c.phone : '<span style="color:var(--color-debt)">⚠️ لا يوجد هاتف</span>'}
                  </div>
                </div>
              </label>
              <div style="text-align: left;">
                <div class="amount text-danger" style="font-weight: 800; color: var(--color-debt);">${ValidationService.formatMoney(c.balance, cur)}</div>
                <button class="btn btn-outline btn-sm" style="margin-top: 4px; padding: 2px 8px; font-size: 11px;" onclick="App.openSendSmsModal('${c.id}')">إرسال فردي</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ==========================================
  // 7. SMS Templates & Logs
  // ==========================================
  function renderSmsTemplates() {
    const list = SmsService.getTemplates();
    const container = document.getElementById('sms-templates-container');
    if (!container) return;

    container.innerHTML = list.map(t => `
      <div class="card" style="margin-bottom: 12px;">
        <div class="card-header">
          <div class="card-title">📝 ${t.name}</div>
          <div>
            <button class="btn btn-outline btn-sm" onclick="App.openEditTemplateModal('${t.id}')">تعديل</button>
            <button class="btn btn-outline btn-sm" style="color: var(--color-debt);" onclick="App.deleteTemplatePrompt('${t.id}')">حذف</button>
          </div>
        </div>
        <div style="font-size: 13px; line-height: 1.6; background: var(--color-bg); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); white-space: pre-wrap;">${t.content}</div>
        <div class="form-hint" style="margin-top: 8px;">
          المتغيرات المدعومة: {اسم_العميل} ، {الرصيد} ، {إجمالي_الديون} ، {إجمالي_المدفوعات} ، {التاريخ}
        </div>
      </div>
    `).join('');
  }

  function renderSmsLogs() {
    const list = SmsService.getLogs();
    const container = document.getElementById('sms-logs-container');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📨</div>
          <div class="empty-title">سجل الرسائل فارغ</div>
          <div class="empty-desc">سيتم أرشفة أي رسالة ترسلها أو تجهزها هنا للرجوع إليها مستقبلاً.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
        <button class="btn btn-outline btn-sm" style="color: var(--color-debt);" onclick="App.clearSmsLogsPrompt()">مسح السجل</button>
      </div>
      ${list.map(log => `
        <div class="tx-item" style="margin-bottom: 8px; flex-direction: column; align-items: flex-start; gap: 6px;">
          <div style="display: flex; justify-content: space-between; width: 100%;">
            <strong>👤 ${log.customerName} (📞 ${log.phone})</strong>
            <span class="badge badge-payment">جاهزة/مرسلة</span>
          </div>
          <div style="font-size: 13px; color: var(--color-text-main); background: var(--color-bg); padding: 8px; border-radius: 6px; width: 100%;">
            ${log.renderedMessage}
          </div>
          <div class="tx-meta">📅 ${new Date(log.preparedAt).toLocaleString('ar-EG')}</div>
        </div>
      `).join('')}
    `;
  }

  // ==========================================
  // 8. Financial Reports
  // ==========================================
  function renderReports() {
    const reportType = document.getElementById('report-type-select') ? document.getElementById('report-type-select').value : 'all_balances';
    const periodSelect = document.getElementById('report-period-select') ? document.getElementById('report-period-select').value : 'all';
    const customStart = document.getElementById('report-start-date') ? document.getElementById('report-start-date').value : '';
    const customEnd = document.getElementById('report-end-date') ? document.getElementById('report-end-date').value : '';

    const container = document.getElementById('report-output-container');
    const settings = AppDatabase.getSettings();
    const cur = settings.currency || 'ر.ي';

    if (!container) return;

    // Build data according to report type
    let title = '';
    let headers = [];
    let rows = [];
    let totalsHtml = '';

    if (reportType === 'all_balances' || reportType === 'debtors' || reportType === 'settled') {
      let filter = 'all';
      if (reportType === 'debtors') filter = 'debtors';
      if (reportType === 'settled') filter = 'settled';

      const customers = CustomerService.getCustomers(filter);
      title = reportType === 'debtors' ? 'تقرير العملاء المدينين' : (reportType === 'settled' ? 'تقرير العملاء المسددين' : 'تقرير الأرصدة المتبقية لكافة العملاء');
      headers = ['اسم العميل', 'رقم الهاتف', 'إجمالي الديون', 'إجمالي المدفوعات', 'الرصيد المتبقي'];

      let sumDebts = 0;
      let sumPayments = 0;
      let sumBalance = 0;

      rows = customers.map(c => {
        sumDebts += c.totalDebts;
        sumPayments += c.totalPayments;
        sumBalance += c.balance;
        return [
          c.name,
          c.phone || '-',
          ValidationService.formatMoney(c.totalDebts, cur),
          ValidationService.formatMoney(c.totalPayments, cur),
          ValidationService.formatMoney(c.balance, cur)
        ];
      });

      totalsHtml = `
        <div class="stats-grid" style="margin-top: 14px;">
          <div class="stat-card debt-border">
            <div class="stat-label">مجموع الديون</div>
            <div class="stat-value">${ValidationService.formatMoney(sumDebts, cur)}</div>
          </div>
          <div class="stat-card payment-border">
            <div class="stat-label">مجموع المدفوعات</div>
            <div class="stat-value">${ValidationService.formatMoney(sumPayments, cur)}</div>
          </div>
          <div class="stat-card balance-border">
            <div class="stat-label">صافي الأرصدة المستحقة</div>
            <div class="stat-value">${ValidationService.formatMoney(sumBalance, cur)}</div>
          </div>
        </div>
      `;
    } else if (reportType === 'transactions') {
      const dates = periodSelect !== 'custom' ? ReportService.getPeriodDateRange(periodSelect) : { start: customStart, end: customEnd };
      const txs = TransactionService.getTransactions({
        startDate: dates.start,
        endDate: dates.end
      });

      title = 'تقرير العمليات المالية';
      headers = ['التاريخ', 'اسم العميل', 'نوع العملية', 'المبلغ', 'الرقم المرجعي', 'البيان والملاحظات'];

      let sumD = 0;
      let sumP = 0;

      rows = txs.map(t => {
        const isDebt = t.type === 'debt' || (t.type === 'opening' && t.amount >= 0);
        if (t.status !== 'cancelled') {
          if (isDebt) sumD += t.amount;
          else sumP += t.amount;
        }
        return [
          t.date,
          t.customerName,
          t.type === 'debt' ? 'دين' : (t.type === 'payment' ? 'دفعة' : 'افتتاحي'),
          ValidationService.formatMoney(t.amount, cur),
          t.reference || '-',
          t.notes || '-'
        ];
      });

      totalsHtml = `
        <div class="stats-grid" style="margin-top: 14px;">
          <div class="stat-card debt-border">
            <div class="stat-label">إجمالي الديون بالفترة</div>
            <div class="stat-value">${ValidationService.formatMoney(sumD, cur)}</div>
          </div>
          <div class="stat-card payment-border">
            <div class="stat-label">إجمالي المسدد بالفترة</div>
            <div class="stat-value">${ValidationService.formatMoney(sumP, cur)}</div>
          </div>
          <div class="stat-card balance-border">
            <div class="stat-label">صافي حركة الفترة</div>
            <div class="stat-value">${ValidationService.formatMoney(sumD - sumP, cur)}</div>
          </div>
        </div>
      `;
    } else if (reportType === 'remittances') {
      const remits = RemittanceService.getRemittances();
      title = 'تقرير الحوالات الواردة';
      headers = ['التاريخ', 'الشركة', 'المرسل', 'الرقم المرجعي', 'المبلغ', 'العميل', 'الحالة'];
      let totalRemitAmount = 0;

      rows = remits.map(r => {
        totalRemitAmount += r.amount;
        return [
          r.date,
          r.company,
          r.senderName || '-',
          r.reference,
          ValidationService.formatMoney(r.amount, cur),
          r.customerName,
          r.matchingStatus === 'recorded_as_payment' ? 'مسجلة كدفعة' : 'بانتظار التأكيد'
        ];
      });

      totalsHtml = `
        <div class="stat-card payment-border" style="margin-top: 14px;">
          <div class="stat-label">إجمالي مبالغ الحوالات الواردة</div>
          <div class="stat-value">${ValidationService.formatMoney(totalRemitAmount, cur)}</div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="statement-sheet">
        <div class="statement-header">
          <div>
            <div class="statement-title">${title}</div>
            <div class="statement-meta">تاريخ الاستخراج: ${ValidationService.formatDate()} • التطبيق: ${settings.appTitle}</div>
          </div>
          <div class="no-print">
            <button class="btn btn-outline btn-sm" onclick="App.exportCurrentReportCsv()">تصدير CSV 📥</button>
            <button class="btn btn-primary btn-sm" onclick="window.print()">طباعة 🖨️</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="app-table">
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.length === 0 
                ? `<tr><td colspan="${headers.length}" style="text-align: center; padding: 20px;">لا توجد بيانات مطابقة لهذا التقرير.</td></tr>` 
                : rows.map(r => `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>

        ${totalsHtml}
      </div>
    `;

    // Save for CSV export
    appState.currentReport = { title, headers, rows };
  }

  // ==========================================
  // 9. Smart Local Assistant
  // ==========================================
  function renderAssistant() {
    const insights = AssistantService.runAudit();
    const container = document.getElementById('assistant-insights-container');
    if (!container) return;

    container.innerHTML = `
      <div style="background: linear-gradient(135deg, #087FA8 0%, #103B59 100%); color: #fff; padding: 16px; border-radius: var(--radius-md); margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
          <span style="font-size: 24px;">🧠</span>
          <h3 style="font-size: 16px; font-weight: 700; margin: 0;">المساعد المحاسبي الذكي المحلي</h3>
        </div>
        <p style="font-size: 12px; opacity: 0.9; margin: 0; line-height: 1.5;">
          يعمل المساعد بقواعد برمجية ذكية صارمة داخل جهازك بنسبة 100% دون إرسال أي بيانات لخوادم خارجية، لضمان أعلى درجات الخصوصية المالية.
        </p>
      </div>
      <div>
        ${insights.map(item => `
          <div class="insight-item">
            <div class="insight-icon">${item.icon}</div>
            <div class="insight-content" style="flex: 1;">
              <h4>${item.title}</h4>
              <p>${item.description}</p>
              ${item.details && item.details.length ? `
                <ul style="margin: 6px 16px 0 0; font-size: 12px; color: var(--color-text-main);">
                  ${item.details.map(d => `<li>${d}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ==========================================
  // 10. Settings & Customization
  // ==========================================
  function renderSettings() {
    const settings = AppDatabase.getSettings();

    const appTitleInput = document.getElementById('setting-app-title');
    const currencySelect = document.getElementById('setting-currency');
    const overpaymentCheck = document.getElementById('setting-overpayment');
    const themeSelect = document.getElementById('setting-theme');
    const accentSelect = document.getElementById('setting-accent');

    if (appTitleInput) appTitleInput.value = settings.appTitle;
    if (currencySelect) currencySelect.value = settings.currency;
    if (overpaymentCheck) overpaymentCheck.checked = settings.preventOverpayment;
    if (themeSelect) themeSelect.value = settings.theme;
    if (accentSelect) accentSelect.value = settings.accentColor;

    // Render default icon picker in settings
    renderIconPicker('settings-default-icon-picker', 'setting-default-icon', settings.defaultCustomerIcon || '👤');
  }

  // ==========================================
  // 11. About & Test Runner
  // ==========================================
  function renderAbout() {
    // Info view
  }

  // ==========================================
  // Modals & User Actions (Exported to window.App)
  // ==========================================
  window.App = {
    navigateTo,
    showToast,

    // Icon Picker Selector
    selectIconPicker: function(containerId, hiddenInputId, icon) {
      const hiddenInput = document.getElementById(hiddenInputId);
      if (hiddenInput) hiddenInput.value = icon;
      const container = document.getElementById(containerId);
      if (container) {
        const btns = container.querySelectorAll('.icon-picker-btn');
        btns.forEach(b => {
          if (b.getAttribute('data-icon') === icon) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
      }
    },

    // Customer Actions
    openAddCustomerModal: function() {
      document.getElementById('modal-customer-title').textContent = 'إضافة عميل جديد';
      document.getElementById('cust-form-id').value = '';
      document.getElementById('cust-form-name').value = '';
      document.getElementById('cust-form-phone').value = '';
      document.getElementById('cust-form-notes').value = '';
      document.getElementById('cust-form-category').value = 'عميل عادي';
      const settings = AppDatabase.getSettings();
      const defaultIcon = (settings && settings.defaultCustomerIcon) ? settings.defaultCustomerIcon : '👤';
      document.getElementById('cust-form-icon').value = defaultIcon;
      renderIconPicker('cust-icon-picker-grid', 'cust-form-icon', defaultIcon);
      document.getElementById('phone-duplicate-warning').style.display = 'none';
      App.openModal('modal-customer');
    },

    openEditCustomerModal: function(customerId) {
      const c = CustomerService.getCustomerById(customerId);
      if (!c) return;
      document.getElementById('modal-customer-title').textContent = 'تعديل بيانات العميل';
      document.getElementById('cust-form-id').value = c.id;
      document.getElementById('cust-form-name').value = c.name;
      document.getElementById('cust-form-phone').value = c.phone || '';
      document.getElementById('cust-form-notes').value = c.notes || '';
      document.getElementById('cust-form-category').value = c.category || 'عميل عادي';
      document.getElementById('cust-form-icon').value = c.icon || '👤';
      renderIconPicker('cust-icon-picker-grid', 'cust-form-icon', c.icon || '👤');
      document.getElementById('phone-duplicate-warning').style.display = 'none';
      App.openModal('modal-customer');
    },

    saveCustomerSubmit: function() {
      const id = document.getElementById('cust-form-id').value;
      const name = document.getElementById('cust-form-name').value;
      const phone = document.getElementById('cust-form-phone').value;
      const notes = document.getElementById('cust-form-notes').value;
      const category = document.getElementById('cust-form-category').value;
      const icon = document.getElementById('cust-form-icon').value;

      try {
        if (id) {
          CustomerService.updateCustomer(id, { name, phone, notes, category, icon });
          showToast('تم تحديث بيانات وتصنيف العميل بنجاح مع الاحتفاظ بكافة العمليات.', 'success');
        } else {
          CustomerService.addCustomer({ name, phone, notes, category, icon });
          showToast('تمت إضافة العميل بنجاح.', 'success');
        }
        App.closeModal('modal-customer');
        renderScreen(appState.currentScreen, { customerId: id });
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    checkPhoneDuplicateInput: function(input) {
      const phone = input.value;
      const id = document.getElementById('cust-form-id').value;
      const warningBox = document.getElementById('phone-duplicate-warning');
      const dup = CustomerService.checkDuplicatePhone(phone, id);

      if (dup) {
        warningBox.textContent = `تنبيه: هذا الرقم مسجل مسبقاً للعميل "${dup.customer.name}".`;
        warningBox.style.display = 'block';
      } else {
        warningBox.style.display = 'none';
      }
    },

    viewCustomer: function(customerId) {
      appState.activeCustomerId = customerId;
      navigateTo('customer_detail', { customerId });
    },

    toggleArchiveCustomer: function(customerId) {
      try {
        const c = CustomerService.toggleArchiveCustomer(customerId);
        showToast(c.archived ? 'تم أرشفة العميل.' : 'تم إلغاء أرشفة العميل.', 'info');
        renderScreen(appState.currentScreen, { customerId });
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    deleteCustomer: function(customerId) {
      const customer = CustomerService.getCustomerById(customerId);
      if (!customer) return;

      if (customer.txCount > 0) {
        if (confirm(`لا يمكن حذف العميل "${customer.name}" لوجود (${customer.txCount}) عمليات مالية مسجلة.\n\nهل ترغب في أرشفته بدلاً من ذلك لإخفائه من القوائم النشطة مع الحفاظ على العمليات؟`)) {
          App.toggleArchiveCustomer(customerId);
        }
        return;
      }

      if (confirm(`هل أنت متأكد من حذف العميل "${customer.name}" نهائياً؟`)) {
        try {
          CustomerService.deleteCustomer(customerId);
          showToast('تم حذف العميل بنجاح.', 'success');
          navigateTo('customers');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    },

    // Transaction Actions
    openRecordDebtModal: function(customerId = null) {
      App.populateCustomerDropdown('tx-form-customer', customerId);
      document.getElementById('tx-form-type').value = 'debt';
      document.getElementById('modal-tx-title').textContent = 'تسجيل دين جديد';
      document.getElementById('tx-form-amount').value = '';
      document.getElementById('tx-form-date').value = ValidationService.formatDate();
      document.getElementById('tx-form-ref').value = '';
      document.getElementById('tx-form-notes').value = '';
      const dueGroup = document.getElementById('tx-form-duedate-group');
      if (dueGroup) dueGroup.style.display = 'block';
      const dueInput = document.getElementById('tx-form-duedate');
      if (dueInput) dueInput.value = '';
      App.openModal('modal-transaction');
    },

    openRecordPaymentModal: function(customerId = null) {
      App.populateCustomerDropdown('tx-form-customer', customerId);
      document.getElementById('tx-form-type').value = 'payment';
      document.getElementById('modal-tx-title').textContent = 'تسجيل دفعة / سداد';
      document.getElementById('tx-form-amount').value = '';
      document.getElementById('tx-form-date').value = ValidationService.formatDate();
      document.getElementById('tx-form-ref').value = '';
      document.getElementById('tx-form-notes').value = '';
      const dueGroup = document.getElementById('tx-form-duedate-group');
      if (dueGroup) dueGroup.style.display = 'none';
      const dueInput = document.getElementById('tx-form-duedate');
      if (dueInput) dueInput.value = '';
      App.openModal('modal-transaction');
    },

    populateCustomerDropdown: function(selectId, selectedId = null) {
      const select = document.getElementById(selectId);
      if (!select) return;
      const customers = CustomerService.getCustomers('all');
      select.innerHTML = '<option value="">-- اختر العميل --</option>' + 
        customers.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.icon || '👤'} ${c.name} [${c.category || 'عادي'}] (الرصيد: ${c.balance})</option>`).join('');
    },

    saveTransactionSubmit: function() {
      const saveBtn = document.getElementById('btn-save-tx');
      if (saveBtn) saveBtn.disabled = true;

      const customerId = document.getElementById('tx-form-customer').value;
      const type = document.getElementById('tx-form-type').value;
      const amount = document.getElementById('tx-form-amount').value;
      const date = document.getElementById('tx-form-date').value;
      const dueDateInput = document.getElementById('tx-form-duedate');
      const dueDate = (type === 'debt' && dueDateInput) ? dueDateInput.value : null;
      const reference = document.getElementById('tx-form-ref').value;
      const notes = document.getElementById('tx-form-notes').value;

      try {
        const res = TransactionService.recordTransaction({
          customerId,
          type,
          amount,
          date,
          dueDate,
          reference,
          notes
        });

        showToast(`تم تسجيل العملية بنجاح! الرصيد الجديد: ${res.newBalance}`, 'success');
        App.closeModal('modal-transaction');
        renderScreen(appState.currentScreen, { customerId });
      } catch (err) {
        showToast(err.message, 'error', 4500);
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    },

    cancelTransactionPrompt: function(txId) {
      const reason = prompt('يرجى كتابة سبب إلغاء هذه العملية:');
      if (reason === null) return;

      try {
        TransactionService.cancelTransaction(txId, reason);
        showToast('تم إلغاء العملية وتحديث الأرصدة بأمان.', 'info');
        renderScreen(appState.currentScreen, { customerId: appState.activeCustomerId });
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    // Remittance Actions
    openAddRemittanceModal: function() {
      const compSelect = document.getElementById('remit-form-company');
      compSelect.innerHTML = RemittanceService.getCompanies().map(c => `<option value="${c}">${c}</option>`).join('');
      App.populateCustomerDropdown('remit-form-customer');

      document.getElementById('remit-form-amount').value = '';
      document.getElementById('remit-form-ref').value = '';
      document.getElementById('remit-form-sender').value = '';
      document.getElementById('remit-form-phone').value = '';
      document.getElementById('remit-form-date').value = ValidationService.formatDate();
      document.getElementById('remit-form-notes').value = '';
      App.openModal('modal-remittance');
    },

    saveRemittanceSubmit: function() {
      const saveBtn = document.getElementById('btn-save-remit');
      if (saveBtn) saveBtn.disabled = true;

      const company = document.getElementById('remit-form-company').value;
      const amount = document.getElementById('remit-form-amount').value;
      const reference = document.getElementById('remit-form-ref').value;
      const senderName = document.getElementById('remit-form-sender').value;
      const senderPhone = document.getElementById('remit-form-phone').value;
      const customerId = document.getElementById('remit-form-customer').value;
      const date = document.getElementById('remit-form-date').value;
      const notes = document.getElementById('remit-form-notes').value;

      try {
        RemittanceService.addRemittance({
          company,
          amount,
          reference,
          senderName,
          senderPhone,
          customerId,
          date,
          notes
        });

        showToast('تم تسجيل الحوالة بنجاح.', 'success');
        App.closeModal('modal-remittance');
        renderScreen('remittances');
      } catch (err) {
        showToast(err.message, 'error', 4500);
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    },

    openLinkRemittanceModal: function(remitId) {
      appState.activeRemittanceId = remitId;
      App.populateCustomerDropdown('link-remit-customer');
      App.openModal('modal-link-remittance');
    },

    saveLinkRemittanceSubmit: function() {
      const custId = document.getElementById('link-remit-customer').value;
      if (!custId) {
        showToast('يرجى اختيار العميل.', 'warning');
        return;
      }

      try {
        RemittanceService.linkCustomer(appState.activeRemittanceId, custId);
        showToast('تم ربط الحوالة بالعميل بنجاح.', 'success');
        App.closeModal('modal-link-remittance');
        renderScreen('remittances');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    confirmRemittanceAsPayment: function(remitId) {
      if (!confirm('هل ترغب بتأكيد هذه الحوالة وترحيلها كدفعة مسددة لحساب العميل؟')) return;

      try {
        const res = RemittanceService.confirmAsPayment(remitId);
        showToast(`تم ترحيل الحوالة كدفعة بنجاح! الرصيد الجديد: ${res.newBalance}`, 'success');
        renderScreen('remittances');
      } catch (err) {
        showToast(err.message, 'error', 4500);
      }
    },

    // SMS Actions
    openSendSmsModal: function(customerId) {
      const customer = CustomerService.getCustomerById(customerId);
      if (!customer) return;

      appState.activeSmsCustomer = customer;
      const templates = SmsService.getTemplates();
      const defaultTpl = templates[0] ? templates[0].content : '';
      const rendered = SmsService.renderTemplate(defaultTpl, customer);

      document.getElementById('sms-modal-customer-name').textContent = customer.name;
      document.getElementById('sms-modal-phone').textContent = customer.phone || 'غير مسجل';
      document.getElementById('sms-modal-balance').textContent = customer.balance;
      document.getElementById('sms-modal-text').value = rendered;

      // Populate template selector inside modal
      const modalTplSelect = document.getElementById('sms-modal-tpl-select');
      if (modalTplSelect) {
        modalTplSelect.innerHTML = templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        modalTplSelect.onchange = function() {
          const chosen = templates.find(t => t.id === modalTplSelect.value);
          if (chosen) {
            document.getElementById('sms-modal-text').value = SmsService.renderTemplate(chosen.content, customer);
          }
        };
      }

      App.openModal('modal-send-sms');
    },

    dispatchSmsSubmit: function() {
      const customer = appState.activeSmsCustomer;
      const text = document.getElementById('sms-modal-text').value;

      try {
        const res = SmsService.dispatchSms(customer, text);
        showToast('تم فتح تطبيق الرسائل لتأكيد الإرسال.', 'success');
        App.closeModal('modal-send-sms');
        renderScreen(appState.currentScreen, { customerId: customer.id });
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    toggleSelectAllDebtors: function(masterCheckbox) {
      const boxes = document.querySelectorAll('.debtor-checkbox');
      boxes.forEach(b => b.checked = masterCheckbox.checked);
    },

    prepareBulkSmsQueue: function() {
      const checkedBoxes = Array.from(document.querySelectorAll('.debtor-checkbox:checked'));
      if (checkedBoxes.length === 0) {
        showToast('يرجى تحديد عميل واحد على الأقل.', 'warning');
        return;
      }

      appState.smsQueue = checkedBoxes.map(b => b.value);
      appState.smsQueueIndex = 0;
      App.openNextInSmsQueue();
    },

    openNextInSmsQueue: function() {
      if (appState.smsQueueIndex >= appState.smsQueue.length) {
        showToast('اكتملت مراجعة جميع الرسائل المحددة.', 'success');
        return;
      }

      const custId = appState.smsQueue[appState.smsQueueIndex];
      appState.smsQueueIndex++;
      App.openSendSmsModal(custId);
    },

    // Templates Actions
    openAddTemplateModal: function() {
      document.getElementById('tpl-form-id').value = '';
      document.getElementById('tpl-form-name').value = '';
      document.getElementById('tpl-form-content').value = '';
      App.openModal('modal-template');
    },

    openEditTemplateModal: function(id) {
      const t = SmsService.getTemplates().find(x => x.id === id);
      if (!t) return;
      document.getElementById('tpl-form-id').value = t.id;
      document.getElementById('tpl-form-name').value = t.name;
      document.getElementById('tpl-form-content').value = t.content;
      App.openModal('modal-template');
    },

    saveTemplateSubmit: function() {
      const id = document.getElementById('tpl-form-id').value;
      const name = document.getElementById('tpl-form-name').value;
      const content = document.getElementById('tpl-form-content').value;

      try {
        if (id) {
          SmsService.updateTemplate(id, name, content);
          showToast('تم تحديث القالب.', 'success');
        } else {
          SmsService.addTemplate(name, content);
          showToast('تمت إضافة القالب.', 'success');
        }
        App.closeModal('modal-template');
        renderScreen('sms_templates');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    deleteTemplatePrompt: function(id) {
      if (!confirm('هل ترغب بحذف هذا القالب؟')) return;
      try {
        SmsService.deleteTemplate(id);
        showToast('تم حذف القالب.', 'info');
        renderScreen('sms_templates');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    clearSmsLogsPrompt: function() {
      if (!confirm('هل أنت متأكد من رغبتك في تفريغ سجل الرسائل؟')) return;
      SmsService.clearLogs();
      showToast('تم تفريغ السجل.', 'info');
      renderScreen('sms_logs');
    },

    // Statement Print & Share
    printCustomerStatement: function(customerId) {
      navigateTo('customer_detail', { customerId });
      setTimeout(() => window.print(), 300);
    },

    exportCurrentReportCsv: function() {
      if (!appState.currentReport) return;
      const { title, headers, rows } = appState.currentReport;
      const filename = `${title.replace(/\s+/g, '_')}_${ValidationService.formatDate()}.csv`;
      ReportService.exportToCsv(filename, headers, rows);
      showToast('تم تصدير ملف CSV بنجاح.', 'success');
    },

    // Backup & Restore Actions
    exportFullBackup: function() {
      try {
        const res = BackupService.exportFullBackup();
        showToast(`تم تصدير النسخة الاحتياطية (${res.filename}) بنجاح.`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    triggerRestoreFilePicker: function() {
      document.getElementById('restore-file-input').click();
    },

    handleRestoreFileSelect: function(input) {
      const file = input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const parsed = JSON.parse(e.target.result);
          const validation = BackupService.validateBackupData(parsed);

          appState.backupPreviewData = parsed;
          document.getElementById('restore-preview-cust').textContent = validation.customersCount;
          document.getElementById('restore-preview-tx').textContent = validation.transactionsCount;
          document.getElementById('restore-preview-remit').textContent = validation.remittancesCount;
          document.getElementById('restore-preview-version').textContent = validation.formatVersion;
          document.getElementById('restore-preview-date').textContent = validation.exportedAt || 'غير محدد';

          App.openModal('modal-restore-preview');
        } catch (err) {
          showToast('الملف المحدد غير صالح: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
      input.value = ''; // Reset input
    },

    confirmRestoreSubmit: function(mode) {
      if (!appState.backupPreviewData) return;
      const confirmMsg = mode === 'full' 
        ? 'تحذير: سيتم استبدال كامل بيانات التطبيق الحالية بالنسخة الاحتياطية (مع إنشاء نسخة أمان تلقائية). هل ترغب بالمتابعة؟'
        : 'سيتم دمج البيانات الجديدة مع البيانات الحالية ومنع التكرار. هل ترغب بالمتابعة؟';

      if (!confirm(confirmMsg)) return;

      try {
        BackupService.restoreBackup(appState.backupPreviewData, mode);
        showToast('تمت استعادة البيانات بنجاح تام!', 'success');
        App.closeModal('modal-restore-preview');
        appState.backupPreviewData = null;
        renderScreen(appState.currentScreen);
      } catch (err) {
        showToast(err.message, 'error', 5000);
      }
    },

    // CSV Import Actions
    triggerCsvFilePicker: function() {
      document.getElementById('csv-file-input').click();
    },

    handleCsvFileSelect: function(input) {
      const file = input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const text = e.target.result;
          const parsedRows = ImportCsvService.parseCsvText(text);
          if (parsedRows.length <= 1) {
            throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات.');
          }

          const headers = parsedRows[0];
          const detectedMapping = ImportCsvService.detectColumns(headers);
          const analysis = ImportCsvService.analyzeCsv(parsedRows, detectedMapping);

          appState.csvAnalysis = analysis;
          document.getElementById('csv-preview-total').textContent = analysis.totalRows;
          document.getElementById('csv-preview-valid').textContent = analysis.validCount;
          document.getElementById('csv-preview-invalid').textContent = analysis.invalidCount;
          document.getElementById('csv-preview-dup').textContent = analysis.duplicateCount;

          App.openModal('modal-csv-preview');
        } catch (err) {
          showToast('فشل قراءة ملف CSV: ' + err.message, 'error');
        }
      };
      reader.readAsText(file, 'utf-8');
      input.value = '';
    },

    confirmCsvImportSubmit: function() {
      if (!appState.csvAnalysis || !appState.csvAnalysis.validRows.length) return;

      try {
        const res = ImportCsvService.executeImport(appState.csvAnalysis.validRows);
        showToast(`تم استيراد (${res.importedCustomers}) عملاء و (${res.createdTransactions}) قيود افتتاحية موثقة بنجاح.`, 'success');
        App.closeModal('modal-csv-preview');
        appState.csvAnalysis = null;
        renderScreen('customers');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    // Settings Actions
    saveSettingsSubmit: function() {
      const appTitle = document.getElementById('setting-app-title').value;
      const currency = document.getElementById('setting-currency').value;
      const preventOverpayment = document.getElementById('setting-overpayment').checked;
      const theme = document.getElementById('setting-theme').value;
      const accentColor = document.getElementById('setting-accent').value;
      const defaultIconInput = document.getElementById('setting-default-icon');
      const defaultCustomerIcon = defaultIconInput ? defaultIconInput.value : '👤';

      SettingsService.updateSettings({
        appTitle,
        currency,
        preventOverpayment,
        theme,
        accentColor,
        defaultCustomerIcon
      });

      showToast('تم حفظ الإعدادات وتطبيق المظهر فوراً.', 'success');
    },

    resetAllDataPrompt: function() {
      const confirmation = prompt('تحذير شديد: سيتم مسح كافة العملاء والديون والمدفوعات والحوالات نهائياً.\n\nلتأكيد المسح التام، اكتب كلمة "حذف" في المربع أدناه:');
      if (confirmation === 'حذف') {
        AppDatabase.resetAll();
        showToast('تمت إعادة ضبط المصنع ومسح كافة البيانات.', 'info');
        renderScreen('dashboard');
      } else if (confirmation !== null) {
        showToast('تم إلغاء عملية المسح (الكلمة المدخلة غير مطابقة).', 'warning');
      }
    },

    // Test Suite Execution
    runAutomatedTestSuite: function() {
      const resultsContainer = document.getElementById('test-results-container');
      if (!resultsContainer) return;

      resultsContainer.innerHTML = '<div style="text-align:center; padding: 20px;">جاري تشغيل الاختبارات المحاسبية والتخزينية... ⏳</div>';

      setTimeout(() => {
        const testResults = AccountingTestSuite.runAllTests();
        const total = testResults.length;
        const passedCount = testResults.filter(t => t.passed).length;
        const allPassed = passedCount === total;

        resultsContainer.innerHTML = `
          <div style="background: ${allPassed ? '#DCFCE7' : '#FEE2E2'}; color: ${allPassed ? '#166534' : '#991B1B'}; padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px; border: 1px solid ${allPassed ? '#86EFAC' : '#FCA5A5'};">
            <strong>نتيجة الفحص المحاسبي والتخزيني:</strong> نجح (${passedCount} من أصل ${total}) اختبارات.
            ${allPassed ? '✅ جميع العمليات المحاسبية وسلامة البيانات تعمل بدقة 100%.' : '⚠️ هناك اختبارات بحاجة لمراجعة.'}
          </div>
          <div>
            ${testResults.map(t => `
              <div class="card" style="margin-bottom: 10px; border-right: 5px solid ${t.passed ? '#16A34A' : '#DC2626'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <strong style="font-size: 13px;">${t.name}</strong>
                  <span class="badge ${t.passed ? 'badge-payment' : 'badge-debt'}">${t.passed ? 'PASS' : 'FAIL'}</span>
                </div>
                <div style="font-size: 12px; color: var(--color-text-muted); line-height: 1.5;">
                  <div><strong>الخطوات:</strong> ${t.steps}</div>
                  <div><strong>المتوقع:</strong> ${t.expected}</div>
                  <div><strong>الفعلي:</strong> ${t.actual}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;

        showToast(allPassed ? 'اكتملت جميع الاختبارات بنجاح!' : 'فشل بعض الاختبارات، راجع التفاصيل.', allPassed ? 'success' : 'error');
      }, 100);
    },

    // Modal Helpers
    openModal: function(modalId) {
      const m = document.getElementById(modalId);
      if (m) m.classList.add('active');
    },

    closeModal: function(modalId) {
      const m = document.getElementById(modalId);
      if (m) m.classList.remove('active');
    }
  };

  // Setup Global Event Listeners for Filters
  const searchCustInput = document.getElementById('customers-search-input');
  if (searchCustInput) {
    searchCustInput.addEventListener('input', () => renderCustomersList());
  }

  const filterCustSelect = document.getElementById('customers-filter-select');
  if (filterCustSelect) {
    filterCustSelect.addEventListener('change', () => renderCustomersList());
  }

  const categoryCustSelect = document.getElementById('customers-category-select');
  if (categoryCustSelect) {
    categoryCustSelect.addEventListener('change', () => renderCustomersList());
  }

  const sortCustSelect = document.getElementById('customers-sort-select');
  if (sortCustSelect) {
    sortCustSelect.addEventListener('change', () => renderCustomersList());
  }

  const txFilter = document.getElementById('tx-filter-type');
  if (txFilter) {
    txFilter.addEventListener('change', () => renderTransactionsList());
  }

  const reportTypeSelect = document.getElementById('report-type-select');
  if (reportTypeSelect) {
    reportTypeSelect.addEventListener('change', () => renderReports());
  }

  const reportPeriodSelect = document.getElementById('report-period-select');
  if (reportPeriodSelect) {
    reportPeriodSelect.addEventListener('change', () => renderReports());
  }

  // Initial render
  navigateTo('dashboard');
});
