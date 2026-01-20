/**
 * 課程報名系統 - 繳費資訊頁面邏輯
 */

let orderData = null;

/**
 * 頁面初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    Utils.updateCartBadge();

    // 讀取訂單資料
    orderData = Utils.getOrderData();

    if (!orderData || !orderData.order_id) {
        Utils.showToast('無訂單資料', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return;
    }

    // 顯示訂單資訊
    displayOrderInfo();

    // 顯示銀行資訊
    displayBankInfo();

    // 綁定表單事件
    bindFormEvents();

    // 設定預設日期
    document.getElementById('paymentDate').valueAsDate = new Date();
});

/**
 * 顯示訂單資訊
 */
function displayOrderInfo() {
    document.getElementById('orderId').textContent = orderData.order_id;
    document.getElementById('totalAmount').textContent = `$${Utils.formatCurrency(orderData.total)}`;
    document.getElementById('deadline').textContent = Utils.getPaymentDeadline();
}

/**
 * 顯示銀行資訊
 */
function displayBankInfo() {
    const bank = CONFIG.BANK_INFO;
    document.getElementById('bankName').textContent = bank.bank_name;
    document.getElementById('bankCode').textContent = bank.bank_code;
    document.getElementById('bankBranch').textContent = bank.branch;
    document.getElementById('accountNumber').textContent = bank.account_number;
    document.getElementById('accountName').textContent = bank.account_name;
}

/**
 * 綁定表單事件
 */
function bindFormEvents() {
    const form = document.getElementById('paymentForm');

    // 帳號後五碼只能輸入數字
    document.getElementById('accountLast5').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    });

    // 表單提交
    form.addEventListener('submit', handleSubmit);
}

/**
 * 處理表單提交
 */
async function handleSubmit(e) {
    e.preventDefault();

    const paymentDate = document.getElementById('paymentDate').value;
    const accountLast5 = document.getElementById('accountLast5').value.trim();
    const paymentAmount = parseInt(document.getElementById('paymentAmount').value);

    // 驗證
    if (!paymentDate) {
        Utils.showToast('請選擇匯款日期', 'error');
        return;
    }

    if (accountLast5.length !== 5) {
        Utils.showToast('請輸入帳號後五碼', 'error');
        return;
    }

    if (!paymentAmount || paymentAmount <= 0) {
        Utils.showToast('請輸入有效的匯款金額', 'error');
        return;
    }

    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '處理中...';

    try {
        const paymentData = {
            order_id: orderData.order_id,
            payment_date: paymentDate,
            account_last5: accountLast5,
            amount: paymentAmount
        };

        const result = await API.submitPayment(paymentData);

        if (result.success) {
            // 顯示成功訊息
            document.getElementById('paymentForm').style.display = 'none';
            document.getElementById('successMessage').style.display = 'block';

            // 清除 sessionStorage
            Utils.clearAllData();

        } else {
            throw new Error(result.error || '回填失敗');
        }

    } catch (error) {
        console.error('回填匯款資訊失敗:', error);
        Utils.showToast(error.message || '回填失敗，請稍後再試', 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = '確認回填';
    }
}
