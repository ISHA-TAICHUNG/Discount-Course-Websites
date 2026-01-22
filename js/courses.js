/**
 * 課程報名系統 - 課程列表頁面邏輯
 */

// 全域變數
let allCourses = [];
let currentFilter = 'all';

/**
 * 頁面初始化
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 更新購物車 badge
    Utils.updateCartBadge();

    // 載入課程
    await loadCourses();

    // 綁定篩選按鈕事件
    bindFilterEvents();
});

/**
 * 載入課程資料
 */
async function loadCourses() {
    const loading = document.getElementById('loading');
    const courseGrid = document.getElementById('courseGrid');
    const emptyState = document.getElementById('emptyState');

    try {
        loading.style.display = 'flex';
        courseGrid.style.display = 'none';
        emptyState.style.display = 'none';

        // 從 API 取得課程
        allCourses = await API.getCourses();

        // 渲染課程
        renderCourses();

    } catch (error) {
        console.error('載入課程失敗:', error);
        Utils.showToast('載入課程失敗，請重新整理頁面', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

/**
 * 渲染課程卡片
 */
function renderCourses() {
    const courseGrid = document.getElementById('courseGrid');
    const emptyState = document.getElementById('emptyState');

    // 篩選課程
    const filteredCourses = currentFilter === 'all'
        ? allCourses
        : allCourses.filter(c => c.location === currentFilter);

    if (filteredCourses.length === 0) {
        courseGrid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    courseGrid.style.display = 'grid';

    courseGrid.innerHTML = filteredCourses.map(course => createCourseCard(course)).join('');

    // 綁定卡片事件
    bindCardEvents();
}

/**
 * 建立課程卡片 HTML
 */
function createCourseCard(course) {
    const sessionsOptions = course.sessions.map(session => {
        return `<option value="${session.session_id}">${session.date}</option>`;
    }).join('');

    return `
        <div class="course-card fade-in" data-course-id="${course.course_id}">
            <div class="course-header">
                <span class="course-location">${Utils.escapeHtml(course.location)}</span>
                <h3 class="course-name">${Utils.escapeHtml(course.course_name)}</h3>
                <p class="course-hours">訓練時數：${course.hours} 小時</p>
            </div>
            <div class="course-body">
                <div class="course-price">
                    <span class="price-label">課程費用</span>
                    <span class="price-value">$${Utils.formatCurrency(course.price)}</span>
                    <span class="price-unit">/ 人</span>
                </div>
                
                <div class="form-group">
                    <label class="form-label">選擇梯次</label>
                    <select class="form-select session-select" data-course-id="${course.course_id}">
                        <option value="">請選擇上課梯次</option>
                        ${sessionsOptions}
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">報名人數</label>
                    <div class="quantity-wrapper">
                        <button type="button" class="quantity-btn minus" data-course-id="${course.course_id}">−</button>
                        <input type="number" class="form-input quantity-input" 
                               id="qty-${course.course_id}" 
                               value="1" min="1" max="99" 
                               data-course-id="${course.course_id}">
                        <button type="button" class="quantity-btn plus" data-course-id="${course.course_id}">+</button>
                    </div>
                </div>
                
                <button type="button" class="add-cart-btn" 
                        data-course-id="${course.course_id}">
                    <svg class="icon-svg icon-sm" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    加入購物車
                </button>
            </div>
        </div>
    `;
}

/**
 * 綁定篩選按鈕事件
 */
function bindFilterEvents() {
    const tabs = document.querySelectorAll('.filter-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 更新 active 狀態
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // 更新篩選條件並重新渲染
            currentFilter = tab.dataset.location;
            renderCourses();
        });
    });
}

/**
 * 綁定課程卡片事件
 */
function bindCardEvents() {
    // 梯次選擇事件
    document.querySelectorAll('.session-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const courseId = e.target.dataset.courseId;
            const sessionId = e.target.value;
            updateQuotaDisplay(courseId, sessionId);
        });
    });

    // 數量增減按鈕
    document.querySelectorAll('.quantity-btn.minus').forEach(btn => {
        btn.addEventListener('click', () => adjustQuantity(btn.dataset.courseId, -1));
    });

    document.querySelectorAll('.quantity-btn.plus').forEach(btn => {
        btn.addEventListener('click', () => adjustQuantity(btn.dataset.courseId, 1));
    });

    // 數量輸入框
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const courseId = e.target.dataset.courseId;
            let value = parseInt(e.target.value) || 1;
            const max = parseInt(e.target.max) || 1;

            if (value < 1) value = 1;
            if (value > max) value = max;

            e.target.value = value;
        });
    });

    // 加入購物車按鈕
    document.querySelectorAll('.add-cart-btn').forEach(btn => {
        btn.addEventListener('click', () => addToCart(btn.dataset.courseId));
    });
}

/**
 * 更新名額顯示
 */
function updateQuotaDisplay(courseId, sessionId) {
    const course = allCourses.find(c => c.course_id === courseId);
    if (!course) return;

    const session = course.sessions.find(s => s.session_id === sessionId);
    const remaining = session ? session.remaining : 0;

    const quotaDiv = document.getElementById(`quota-${courseId}`);
    const qtyInput = document.getElementById(`qty-${courseId}`);
    const addBtn = document.querySelector(`.add-cart-btn[data-course-id="${courseId}"]`);

    // 更新名額顯示
    quotaDiv.querySelector('.quota-number').textContent = remaining;

    // 更新 class
    quotaDiv.classList.remove('quota-low', 'quota-none');
    if (remaining === 0) quotaDiv.classList.add('quota-none');
    else if (remaining <= 5) quotaDiv.classList.add('quota-low');

    // 更新數量限制
    qtyInput.max = remaining;
    qtyInput.disabled = remaining === 0;
    if (parseInt(qtyInput.value) > remaining) {
        qtyInput.value = remaining || 1;
    }

    // 更新按鈕狀態
    addBtn.disabled = remaining === 0;
}

/**
 * 調整數量
 */
function adjustQuantity(courseId, delta) {
    const input = document.getElementById(`qty-${courseId}`);
    let value = parseInt(input.value) + delta;
    const max = parseInt(input.max) || 1;

    if (value < 1) value = 1;
    if (value > max) value = max;

    input.value = value;
}

/**
 * 加入購物車
 */
function addToCart(courseId) {
    const course = allCourses.find(c => c.course_id === courseId);
    if (!course) return;

    const sessionSelect = document.querySelector(`.session-select[data-course-id="${courseId}"]`);
    const qtyInput = document.getElementById(`qty-${courseId}`);

    const sessionId = sessionSelect.value;
    const quantity = parseInt(qtyInput.value) || 1;

    // 驗證
    if (!sessionId) {
        Utils.showToast('請選擇上課梯次', 'error');
        return;
    }

    const session = course.sessions.find(s => s.session_id === sessionId);
    if (!session) return;

    if (quantity > session.remaining) {
        Utils.showToast('報名人數超過剩餘名額', 'error');
        return;
    }

    // 取得購物車
    const cart = Utils.getCart();

    // 檢查是否已存在相同課程+梯次
    const existingIndex = cart.findIndex(
        item => item.course_id === courseId && item.session_id === sessionId
    );

    if (existingIndex >= 0) {
        // 更新數量
        const newQty = cart[existingIndex].quantity + quantity;
        if (newQty > session.remaining) {
            Utils.showToast('總報名人數超過剩餘名額', 'error');
            return;
        }
        cart[existingIndex].quantity = newQty;
    } else {
        // 新增項目
        cart.push({
            course_id: courseId,
            course_name: course.course_name,
            location: course.location,
            hours: course.hours,
            price: course.price,
            session_id: sessionId,
            session_date: session.date,
            quantity: quantity,
            remaining: session.remaining
        });
    }

    // 儲存購物車
    Utils.saveCart(cart);

    // 顯示成功訊息
    Utils.showToast(`已將「${course.course_name}」加入購物車`);

    // 重置表單
    sessionSelect.value = '';
    qtyInput.value = 1;
}
