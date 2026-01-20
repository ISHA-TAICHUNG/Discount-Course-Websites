/**
 * 課程報名系統 - 共用工具函數
 */

const Utils = {
    /**
     * 格式化金額（加入千分位）
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('zh-TW').format(amount);
    },

    /**
     * 身分證遮罩處理（僅顯示首尾，中間以 * 取代）
     * 例：A123456789 → A12****789
     */
    maskIdNumber(idNumber) {
        if (!idNumber || idNumber.length !== 10) return idNumber;
        return idNumber.substring(0, 3) + '****' + idNumber.substring(7);
    },

    /**
     * 驗證台灣身分證字號格式與檢查碼
     */
    validateIdNumber(id) {
        if (!CONFIG.VALIDATION.id_pattern.test(id)) {
            return false;
        }

        // 英文字母對應數值
        const letterMap = {
            A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17,
            I: 34, J: 18, K: 19, L: 20, M: 21, N: 22, O: 35, P: 23,
            Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29, W: 32, X: 30,
            Y: 31, Z: 33
        };

        const letterValue = letterMap[id[0]];
        const n1 = Math.floor(letterValue / 10);
        const n2 = letterValue % 10;

        const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
        const digits = [n1, n2, ...id.slice(1).split('').map(Number)];

        let sum = 0;
        for (let i = 0; i < digits.length; i++) {
            sum += digits[i] * weights[i];
        }

        return sum % 10 === 0;
    },

    /**
     * 驗證手機號碼
     */
    validatePhone(phone) {
        return CONFIG.VALIDATION.phone_pattern.test(phone);
    },

    /**
     * 驗證 Email
     */
    validateEmail(email) {
        return CONFIG.VALIDATION.email_pattern.test(email);
    },

    /**
     * 驗證民國年日期格式 (YYY/MM/DD)
     */
    validateBirthdate(date) {
        if (!CONFIG.VALIDATION.birthdate_pattern.test(date)) {
            return false;
        }

        const parts = date.split('/');
        const year = parseInt(parts[0]) + 1911; // 轉換為西元年
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);

        const dateObj = new Date(year, month, day);
        return dateObj.getFullYear() === year &&
            dateObj.getMonth() === month &&
            dateObj.getDate() === day;
    },

    /**
     * 產生訂單編號
     */
    generateOrderId() {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `ORD-${dateStr}-${random}`;
    },

    /**
     * 計算匯款截止日期
     */
    getPaymentDeadline() {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + CONFIG.PAYMENT_DEADLINE_DAYS);
        return deadline.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * Toast 通知
     */
    showToast(message, type = 'success') {
        // 移除現有 toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? '✓' : '✕';
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

        document.body.appendChild(toast);

        // 觸發動畫
        setTimeout(() => toast.classList.add('show'), 10);

        // 自動關閉
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * HTML 跳脫（防止 XSS）
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 從 sessionStorage 取得購物車
     */
    getCart() {
        try {
            const cart = sessionStorage.getItem('cart');
            return cart ? JSON.parse(cart) : [];
        } catch (e) {
            console.error('讀取購物車失敗:', e);
            return [];
        }
    },

    /**
     * 儲存購物車至 sessionStorage
     */
    saveCart(cart) {
        try {
            sessionStorage.setItem('cart', JSON.stringify(cart));
            this.updateCartBadge();
        } catch (e) {
            console.error('儲存購物車失敗:', e);
        }
    },

    /**
     * 更新購物車 badge 數量
     */
    updateCartBadge() {
        const badge = document.querySelector('.cart-badge');
        if (!badge) return;

        const cart = this.getCart();
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    },

    /**
     * 從 sessionStorage 取得訂單資料
     */
    getOrderData() {
        try {
            const data = sessionStorage.getItem('orderData');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('讀取訂單資料失敗:', e);
            return null;
        }
    },

    /**
     * 儲存訂單資料至 sessionStorage
     */
    saveOrderData(data) {
        try {
            sessionStorage.setItem('orderData', JSON.stringify(data));
        } catch (e) {
            console.error('儲存訂單資料失敗:', e);
        }
    },

    /**
     * 清除所有 sessionStorage 資料
     */
    clearAllData() {
        sessionStorage.removeItem('cart');
        sessionStorage.removeItem('orderData');
    }
};
