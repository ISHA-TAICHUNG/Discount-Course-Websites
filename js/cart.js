/**
 * 課程報名系統 - 購物車頁面邏輯
 */

/**
 * 頁面初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    Utils.updateCartBadge();
    renderCart();
    bindEvents();
});

/**
 * 渲染購物車
 */
function renderCart() {
    const cart = Utils.getCart();
    const emptyState = document.getElementById('emptyState');
    const cartContainer = document.getElementById('cartContainer');
    const cartItems = document.getElementById('cartItems');

    if (cart.length === 0) {
        emptyState.style.display = 'block';
        cartContainer.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    cartContainer.style.display = 'block';

    // 渲染購物車項目
    cartItems.innerHTML = cart.map((item, index) => createCartItem(item, index)).join('');

    // 計算並顯示金額
    updateTotals();

    // 綁定項目事件
    bindItemEvents();
}

/**
 * 建立購物車項目 HTML
 */
function createCartItem(item, index) {
    return `
        <div class="cart-item" data-index="${index}">
            <div class="item-info">
                <h3>${Utils.escapeHtml(item.course_name)}</h3>
                <p>📍 ${Utils.escapeHtml(item.location)} ｜ 📅 ${Utils.escapeHtml(item.session_date)}</p>
            </div>
            <div class="item-price">$${Utils.formatCurrency(item.price)}</div>
            <div class="item-quantity">
                <div class="quantity-wrapper">
                    <button type="button" class="quantity-btn minus" data-index="${index}">−</button>
                    <input type="number" class="form-input quantity-input" 
                           value="${item.quantity}" min="1" max="${item.remaining}"
                           data-index="${index}">
                    <button type="button" class="quantity-btn plus" data-index="${index}">+</button>
                </div>
            </div>
            <div class="item-subtotal">$${Utils.formatCurrency(item.price * item.quantity)}</div>
            <button type="button" class="remove-btn" data-index="${index}" title="移除">✕</button>
        </div>
    `;
}

/**
 * 計算並更新金額顯示
 */
function updateTotals() {
    const cart = Utils.getCart();
    const discount = calculateDiscount(cart);

    document.getElementById('subtotal').textContent = `$${Utils.formatCurrency(discount.subtotal)}`;
    document.getElementById('totalAmount').textContent = `$${Utils.formatCurrency(discount.total)}`;

    const discountRow = document.getElementById('discountRow');
    const discountHint = document.getElementById('discountHint');

    if (discount.hasDiscount) {
        discountRow.style.display = 'flex';
        discountHint.style.display = 'none';
        document.getElementById('discountAmount').textContent = `-$${Utils.formatCurrency(discount.discountAmount)}`;
    } else {
        discountRow.style.display = 'none';
        // 顯示優惠提示（如果還未達到優惠條件）
        discountHint.style.display = cart.length > 0 ? 'block' : 'none';
    }
}

/**
 * 計算優惠
 * 條件（任一符合即享 8 折）：
 * 1. 購物車內有 ≥2 門不同課程
 * 2. 同一課程報名人數 ≥2 人
 */
function calculateDiscount(cart) {
    if (cart.length === 0) {
        return { subtotal: 0, discountAmount: 0, total: 0, hasDiscount: false };
    }

    // 計算原價小計
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 檢查優惠條件
    const uniqueCourses = new Set(cart.map(item => item.course_id));
    const hasMultipleCourses = uniqueCourses.size >= CONFIG.DISCOUNT.min_courses;
    const hasMultiplePersons = cart.some(item => item.quantity >= CONFIG.DISCOUNT.min_persons);

    const hasDiscount = hasMultipleCourses || hasMultiplePersons;
    const discountRate = hasDiscount ? CONFIG.DISCOUNT.rate : 1;
    const discountAmount = subtotal * (1 - discountRate);
    const total = subtotal * discountRate;

    return {
        subtotal,
        discountAmount: Math.round(discountAmount),
        total: Math.round(total),
        hasDiscount,
        discountRate
    };
}

/**
 * 綁定頁面事件
 */
function bindEvents() {
    document.getElementById('checkoutBtn').addEventListener('click', () => {
        const cart = Utils.getCart();
        if (cart.length === 0) {
            Utils.showToast('購物車是空的', 'error');
            return;
        }

        // 儲存訂單資料並跳轉
        const discount = calculateDiscount(cart);
        Utils.saveOrderData({
            items: cart,
            subtotal: discount.subtotal,
            discountAmount: discount.discountAmount,
            total: discount.total,
            hasDiscount: discount.hasDiscount
        });

        window.location.href = 'registration.html';
    });
}

/**
 * 綁定購物車項目事件
 */
function bindItemEvents() {
    // 減少數量
    document.querySelectorAll('.cart-item .quantity-btn.minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            adjustItemQuantity(index, -1);
        });
    });

    // 增加數量
    document.querySelectorAll('.cart-item .quantity-btn.plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            adjustItemQuantity(index, 1);
        });
    });

    // 數量輸入
    document.querySelectorAll('.cart-item .quantity-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            const value = parseInt(e.target.value) || 1;
            setItemQuantity(index, value);
        });
    });

    // 移除項目
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            removeItem(index);
        });
    });
}

/**
 * 調整項目數量
 */
function adjustItemQuantity(index, delta) {
    const cart = Utils.getCart();
    if (index < 0 || index >= cart.length) return;

    const item = cart[index];
    const newQty = item.quantity + delta;

    if (newQty < 1) {
        removeItem(index);
        return;
    }

    if (newQty > item.remaining) {
        Utils.showToast('已達剩餘名額上限', 'error');
        return;
    }

    cart[index].quantity = newQty;
    Utils.saveCart(cart);
    renderCart();
}

/**
 * 設定項目數量
 */
function setItemQuantity(index, quantity) {
    const cart = Utils.getCart();
    if (index < 0 || index >= cart.length) return;

    const item = cart[index];

    if (quantity < 1) quantity = 1;
    if (quantity > item.remaining) {
        quantity = item.remaining;
        Utils.showToast('已達剩餘名額上限', 'error');
    }

    cart[index].quantity = quantity;
    Utils.saveCart(cart);
    renderCart();
}

/**
 * 移除項目
 */
function removeItem(index) {
    const cart = Utils.getCart();
    if (index < 0 || index >= cart.length) return;

    const removed = cart.splice(index, 1)[0];
    Utils.saveCart(cart);
    Utils.showToast(`已移除「${removed.course_name}」`);
    renderCart();
}
