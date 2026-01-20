/**
 * 課程報名系統 - 報名表單頁面邏輯
 */

let orderData = null;
let totalPersons = 0;

/**
 * 頁面初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    Utils.updateCartBadge();

    // 讀取訂單資料
    orderData = Utils.getOrderData();

    if (!orderData || !orderData.items || orderData.items.length === 0) {
        Utils.showToast('無訂單資料，請先選購課程', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return;
    }

    // 計算總人數
    totalPersons = orderData.items.reduce((sum, item) => sum + item.quantity, 0);

    // 渲染訂單摘要
    renderOrderSummary();

    // 渲染報名人員表單
    renderRegistrantForms();

    // 綁定表單提交事件
    bindFormEvents();
});

/**
 * 渲染訂單摘要
 */
function renderOrderSummary() {
    const container = document.getElementById('orderSummary');

    let itemsHtml = orderData.items.map(item => `
        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e8eaed;">
            <div>
                <strong>${Utils.escapeHtml(item.course_name)}</strong>
                <p style="font-size: 14px; color: #5f6368; margin-top: 4px;">
                    📍 ${Utils.escapeHtml(item.location)} ｜ 📅 ${Utils.escapeHtml(item.session_date)} ｜ 👥 ${item.quantity} 人
                </p>
            </div>
            <div style="font-weight: 600;">$${Utils.formatCurrency(item.price * item.quantity)}</div>
        </div>
    `).join('');

    let discountHtml = '';
    if (orderData.hasDiscount) {
        discountHtml = `
            <div style="display: flex; justify-content: space-between; padding: 12px 0; color: #1e8e3e;">
                <span><span style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; margin-right: 8px;">🎉 8 折優惠</span>折扣金額</span>
                <span>-$${Utils.formatCurrency(orderData.discountAmount)}</span>
            </div>
        `;
    }

    container.innerHTML = `
        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px;">
            ${itemsHtml}
            ${discountHtml}
            <div style="display: flex; justify-content: space-between; padding: 16px 0 0; margin-top: 8px; border-top: 2px solid #dadce0; font-size: 20px; font-weight: 700;">
                <span>應付金額</span>
                <span style="color: #d93025;">$${Utils.formatCurrency(orderData.total)}</span>
            </div>
        </div>
        <p style="margin-top: 16px; font-size: 14px; color: #5f6368;">
            📌 請依照報名人數填寫 <strong>${totalPersons} 位</strong>受訓人員資料
        </p>
    `;
}

/**
 * 渲染報名人員表單
 */
function renderRegistrantForms() {
    const container = document.getElementById('registrantsContainer');

    let formsHtml = '';
    for (let i = 0; i < totalPersons; i++) {
        formsHtml += createRegistrantForm(i + 1);
    }

    container.innerHTML = formsHtml;
}

/**
 * 建立單一報名人員表單
 */
function createRegistrantForm(personNumber) {
    const educationOptions = CONFIG.EDUCATION_OPTIONS.map(
        opt => `<option value="${opt}">${opt}</option>`
    ).join('');

    return `
        <div class="person-card" data-person="${personNumber}">
            <div class="person-card-header">
                <span class="person-number">
                    <span class="badge">${personNumber}</span>
                    第 ${personNumber} 位受訓人員
                </span>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">姓名<span class="required-mark">*</span></label>
                    <input type="text" class="form-input" name="name_${personNumber}" 
                           placeholder="請輸入真實姓名" required>
                    <div class="error-message" id="error_name_${personNumber}"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">身分證字號<span class="required-mark">*</span></label>
                    <input type="text" class="form-input" name="id_${personNumber}" 
                           placeholder="例：A123456789" maxlength="10" required
                           style="text-transform: uppercase;">
                    <div class="error-message" id="error_id_${personNumber}"></div>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">出生年月日（民國年）<span class="required-mark">*</span></label>
                    <input type="text" class="form-input" name="birthdate_${personNumber}" 
                           placeholder="例：080/01/15" maxlength="9" required>
                    <div class="error-message" id="error_birthdate_${personNumber}"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">學歷<span class="required-mark">*</span></label>
                    <select class="form-select" name="education_${personNumber}" required>
                        <option value="">請選擇學歷</option>
                        ${educationOptions}
                    </select>
                    <div class="error-message" id="error_education_${personNumber}"></div>
                </div>
            </div>
            
            <div class="form-group full-width">
                <label class="form-label">聯絡地址<span class="required-mark">*</span></label>
                <input type="text" class="form-input" name="address_${personNumber}" 
                       placeholder="請輸入完整地址" required>
                <div class="error-message" id="error_address_${personNumber}"></div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">聯絡電話<span class="required-mark">*</span></label>
                    <input type="tel" class="form-input" name="phone_${personNumber}" 
                           placeholder="例：0912345678" maxlength="10" required>
                    <div class="error-message" id="error_phone_${personNumber}"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">電子郵件<span class="required-mark">*</span></label>
                    <input type="email" class="form-input" name="email_${personNumber}" 
                           placeholder="例：example@email.com" required>
                    <div class="error-message" id="error_email_${personNumber}"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 綁定表單事件
 */
function bindFormEvents() {
    const form = document.getElementById('registrationForm');

    // 即時驗證
    form.querySelectorAll('input[name^="id_"]').forEach(input => {
        input.addEventListener('blur', () => validateIdNumber(input));
        input.addEventListener('input', () => {
            input.value = input.value.toUpperCase();
        });
    });

    form.querySelectorAll('input[name^="birthdate_"]').forEach(input => {
        input.addEventListener('blur', () => validateBirthdate(input));
    });

    form.querySelectorAll('input[name^="phone_"]').forEach(input => {
        input.addEventListener('blur', () => validatePhone(input));
    });

    form.querySelectorAll('input[name^="email_"]').forEach(input => {
        input.addEventListener('blur', () => validateEmail(input));
    });

    // 表單提交
    form.addEventListener('submit', handleSubmit);
}

/**
 * 驗證身分證字號
 */
function validateIdNumber(input) {
    const personNum = input.name.split('_')[1];
    const errorDiv = document.getElementById(`error_id_${personNum}`);
    const value = input.value.trim().toUpperCase();

    if (!value) {
        showFieldError(input, errorDiv, '請輸入身分證字號');
        return false;
    }

    if (!Utils.validateIdNumber(value)) {
        showFieldError(input, errorDiv, '身分證字號格式不正確');
        return false;
    }

    clearFieldError(input, errorDiv);
    return true;
}

/**
 * 驗證出生日期
 */
function validateBirthdate(input) {
    const personNum = input.name.split('_')[1];
    const errorDiv = document.getElementById(`error_birthdate_${personNum}`);
    const value = input.value.trim();

    if (!value) {
        showFieldError(input, errorDiv, '請輸入出生年月日');
        return false;
    }

    if (!Utils.validateBirthdate(value)) {
        showFieldError(input, errorDiv, '格式不正確，請用民國年 YYY/MM/DD');
        return false;
    }

    clearFieldError(input, errorDiv);
    return true;
}

/**
 * 驗證手機
 */
function validatePhone(input) {
    const personNum = input.name.split('_')[1];
    const errorDiv = document.getElementById(`error_phone_${personNum}`);
    const value = input.value.trim();

    if (!value) {
        showFieldError(input, errorDiv, '請輸入聯絡電話');
        return false;
    }

    if (!Utils.validatePhone(value)) {
        showFieldError(input, errorDiv, '請輸入有效的手機號碼');
        return false;
    }

    clearFieldError(input, errorDiv);
    return true;
}

/**
 * 驗證 Email
 */
function validateEmail(input) {
    const personNum = input.name.split('_')[1];
    const errorDiv = document.getElementById(`error_email_${personNum}`);
    const value = input.value.trim();

    if (!value) {
        showFieldError(input, errorDiv, '請輸入電子郵件');
        return false;
    }

    if (!Utils.validateEmail(value)) {
        showFieldError(input, errorDiv, '請輸入有效的電子郵件');
        return false;
    }

    clearFieldError(input, errorDiv);
    return true;
}

/**
 * 顯示欄位錯誤
 */
function showFieldError(input, errorDiv, message) {
    input.classList.add('error');
    errorDiv.textContent = message;
}

/**
 * 清除欄位錯誤
 */
function clearFieldError(input, errorDiv) {
    input.classList.remove('error');
    errorDiv.textContent = '';
}

/**
 * 處理表單提交
 */
async function handleSubmit(e) {
    e.preventDefault();

    // 驗證所有欄位
    let isValid = true;
    const form = e.target;

    // 驗證每位報名人員
    for (let i = 1; i <= totalPersons; i++) {
        const idInput = form.querySelector(`input[name="id_${i}"]`);
        const birthdateInput = form.querySelector(`input[name="birthdate_${i}"]`);
        const phoneInput = form.querySelector(`input[name="phone_${i}"]`);
        const emailInput = form.querySelector(`input[name="email_${i}"]`);

        if (!validateIdNumber(idInput)) isValid = false;
        if (!validateBirthdate(birthdateInput)) isValid = false;
        if (!validatePhone(phoneInput)) isValid = false;
        if (!validateEmail(emailInput)) isValid = false;

        // 檢查必填欄位
        const nameInput = form.querySelector(`input[name="name_${i}"]`);
        const addressInput = form.querySelector(`input[name="address_${i}"]`);
        const educationSelect = form.querySelector(`select[name="education_${i}"]`);

        if (!nameInput.value.trim()) {
            showFieldError(nameInput, document.getElementById(`error_name_${i}`), '請輸入姓名');
            isValid = false;
        }
        if (!addressInput.value.trim()) {
            showFieldError(addressInput, document.getElementById(`error_address_${i}`), '請輸入地址');
            isValid = false;
        }
        if (!educationSelect.value) {
            showFieldError(educationSelect, document.getElementById(`error_education_${i}`), '請選擇學歷');
            isValid = false;
        }
    }

    // 檢查隱私權同意
    const privacyCheckbox = document.getElementById('privacyAgreed');
    if (!privacyCheckbox.checked) {
        Utils.showToast('請同意個資蒐集聲明', 'error');
        isValid = false;
    }

    if (!isValid) {
        Utils.showToast('請修正表單錯誤', 'error');
        return;
    }

    // 收集報名資料
    const registrants = [];
    for (let i = 1; i <= totalPersons; i++) {
        const idNumber = form.querySelector(`input[name="id_${i}"]`).value.trim().toUpperCase();

        registrants.push({
            name: form.querySelector(`input[name="name_${i}"]`).value.trim(),
            id_number_masked: Utils.maskIdNumber(idNumber), // 遮罩後儲存
            birthdate: form.querySelector(`input[name="birthdate_${i}"]`).value.trim(),
            address: form.querySelector(`input[name="address_${i}"]`).value.trim(),
            phone: form.querySelector(`input[name="phone_${i}"]`).value.trim(),
            email: form.querySelector(`input[name="email_${i}"]`).value.trim(),
            education: form.querySelector(`select[name="education_${i}"]`).value
        });
    }

    // 顯示載入中
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';

    try {
        // 產生訂單編號
        const orderId = Utils.generateOrderId();

        // 準備訂單資料
        const submitData = {
            order_id: orderId,
            items: orderData.items.map(item => ({
                course_id: item.course_id,
                session_id: item.session_id,
                quantity: item.quantity
            })),
            total_amount: orderData.total,
            discount_rate: orderData.hasDiscount ? CONFIG.DISCOUNT.rate : 1,
            registrants: registrants
        };

        // 送出訂單
        const result = await API.submitOrder(submitData);

        if (result.success) {
            // 儲存付款資訊
            Utils.saveOrderData({
                ...orderData,
                order_id: orderId,
                registrants: registrants
            });

            // 清空購物車
            Utils.saveCart([]);

            // 跳轉至付款頁面
            window.location.href = 'payment.html';
        } else {
            throw new Error(result.error || '送出失敗');
        }

    } catch (error) {
        console.error('送出報名失敗:', error);
        Utils.showToast(error.message || '送出報名失敗，請稍後再試', 'error');
    } finally {
        loadingOverlay.style.display = 'none';
    }
}
