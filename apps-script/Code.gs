/**
 * 課程報名系統 - Google Apps Script 後端
 * 
 * 部署說明：
 * 1. 建立新的 Google Apps Script 專案
 * 2. 將此程式碼貼入 Code.gs
 * 3. 建立 Google Sheet 並設定 SHEET_ID
 * 4. 設定 TOKEN
 * 5. 部署 → 新增部署 → Web 應用程式
 *    - 執行身分：我
 *    - 誰可以存取：任何人
 * 6. 複製 Web App URL 至前端 config.js
 * 
 * ⚠️ 資安注意：
 * - TOKEN 需與前端設定一致，且應保持機密
 * - Sheet 不要設為公開共用
 */

// ============================================
// 設定區
// ============================================

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';  // 替換為您的 Google Sheet ID
const TOKEN = 'YOUR_SECURE_TOKEN_HERE';    // 替換為安全的 token

// Sheet 名稱
const SHEET_COURSES = 'Courses';
const SHEET_ORDERS = 'Orders';
const SHEET_REGISTRATIONS = 'Registrations';
const SHEET_PAYMENTS = 'Payments';

// ============================================
// 主要進入點
// ============================================

/**
 * 處理 POST 請求
 */
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        
        // Token 驗證
        if (data.token !== TOKEN) {
            return jsonResponse({ success: false, error: 'Unauthorized' });
        }
        
        // 路由
        switch (data.action) {
            case 'getCourses':
                return getCourses();
            case 'checkQuota':
                return checkQuota(data.session_id);
            case 'submitOrder':
                return submitOrder(data);
            case 'submitPayment':
                return submitPayment(data);
            default:
                return jsonResponse({ success: false, error: 'Unknown action' });
        }
        
    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: error.message });
    }
}

/**
 * 處理 GET 請求（用於測試）
 */
function doGet(e) {
    return jsonResponse({ success: true, message: 'API is running' });
}

// ============================================
// API 功能
// ============================================

/**
 * 取得所有課程資料
 */
function getCourses() {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_COURSES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // 將資料轉換為課程物件
    const coursesMap = {};
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const courseId = row[0];
        const location = row[1];
        const courseName = row[2];
        const price = row[3];
        const hours = row[4];
        const sessionId = row[5];
        const sessionDate = row[6];
        const quota = row[7];
        const remaining = row[8];
        
        if (!coursesMap[courseId]) {
            coursesMap[courseId] = {
                course_id: courseId,
                location: location,
                course_name: courseName,
                price: price,
                hours: hours,
                sessions: []
            };
        }
        
        coursesMap[courseId].sessions.push({
            session_id: sessionId,
            date: sessionDate,
            quota: quota,
            remaining: remaining
        });
    }
    
    return jsonResponse({
        success: true,
        data: Object.values(coursesMap)
    });
}

/**
 * 檢查特定梯次的剩餘名額
 */
function checkQuota(sessionId) {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_COURSES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
        if (data[i][5] === sessionId) {
            return jsonResponse({
                success: true,
                data: { remaining: data[i][8] }
            });
        }
    }
    
    return jsonResponse({ success: false, error: 'Session not found' });
}

/**
 * 送出訂單（含原子化名額扣除）
 */
function submitOrder(data) {
    const lock = LockService.getScriptLock();
    
    try {
        // 等待取得鎖定（最多 10 秒）
        lock.waitLock(10000);
        
        const ss = SpreadsheetApp.openById(SHEET_ID);
        const coursesSheet = ss.getSheetByName(SHEET_COURSES);
        const ordersSheet = ss.getSheetByName(SHEET_ORDERS);
        const registrationsSheet = ss.getSheetByName(SHEET_REGISTRATIONS);
        
        const coursesData = coursesSheet.getDataRange().getValues();
        
        // 1. 檢查所有課程梯次的名額
        for (const item of data.items) {
            let found = false;
            for (let i = 1; i < coursesData.length; i++) {
                if (coursesData[i][5] === item.session_id) {
                    const remaining = coursesData[i][8];
                    if (remaining < item.quantity) {
                        return jsonResponse({
                            success: false,
                            error: `「${coursesData[i][2]}」名額不足，剩餘 ${remaining} 名`
                        });
                    }
                    found = true;
                    break;
                }
            }
            if (!found) {
                return jsonResponse({ success: false, error: '課程梯次不存在' });
            }
        }
        
        // 2. 扣除名額
        for (const item of data.items) {
            for (let i = 1; i < coursesData.length; i++) {
                if (coursesData[i][5] === item.session_id) {
                    const rowIndex = i + 1; // Sheet 是 1-indexed
                    const newRemaining = coursesData[i][8] - item.quantity;
                    coursesSheet.getRange(rowIndex, 9).setValue(newRemaining); // 第 9 欄是 remaining
                    break;
                }
            }
        }
        
        // 3. 寫入訂單
        const now = new Date();
        ordersSheet.appendRow([
            data.order_id,
            now.toISOString(),
            data.total_amount,
            data.discount_rate,
            'pending'
        ]);
        
        // 4. 寫入報名資料
        for (const item of data.items) {
            for (const registrant of data.registrants) {
                registrationsSheet.appendRow([
                    data.order_id,
                    item.course_id,
                    item.session_id,
                    registrant.name,
                    registrant.id_number_masked,  // 已遮罩
                    registrant.birthdate,
                    registrant.address,
                    registrant.phone,
                    registrant.email,
                    registrant.education,
                    now.toISOString()
                ]);
            }
        }
        
        return jsonResponse({
            success: true,
            order_id: data.order_id
        });
        
    } catch (error) {
        console.error('Submit order error:', error);
        return jsonResponse({ success: false, error: error.message });
    } finally {
        lock.releaseLock();
    }
}

/**
 * 回填匯款資訊
 */
function submitPayment(data) {
    try {
        const ss = SpreadsheetApp.openById(SHEET_ID);
        const paymentsSheet = ss.getSheetByName(SHEET_PAYMENTS);
        
        const now = new Date();
        paymentsSheet.appendRow([
            data.order_id,
            data.payment_date,
            data.account_last5,
            data.amount,
            now.toISOString()
        ]);
        
        // 可選：更新訂單狀態
        const ordersSheet = ss.getSheetByName(SHEET_ORDERS);
        const ordersData = ordersSheet.getDataRange().getValues();
        for (let i = 1; i < ordersData.length; i++) {
            if (ordersData[i][0] === data.order_id) {
                ordersSheet.getRange(i + 1, 5).setValue('payment_submitted');
                break;
            }
        }
        
        return jsonResponse({ success: true });
        
    } catch (error) {
        console.error('Submit payment error:', error);
        return jsonResponse({ success: false, error: error.message });
    }
}

// ============================================
// 工具函數
// ============================================

/**
 * 回傳 JSON 格式回應
 */
function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 初始化函數（手動執行一次建立 Sheet 結構）
// ============================================

/**
 * 初始化 Google Sheet 結構
 * 手動執行此函數以建立所需的工作表
 */
function initializeSheets() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    // 建立 Courses sheet
    let coursesSheet = ss.getSheetByName(SHEET_COURSES);
    if (!coursesSheet) {
        coursesSheet = ss.insertSheet(SHEET_COURSES);
        coursesSheet.appendRow([
            'course_id', 'location', 'course_name', 'price', 'hours',
            'session_id', 'date', 'quota', 'remaining'
        ]);
        
        // 加入範例資料
        const sampleCourses = [
            ['DT-001', 'Downtown', '職業安全衛生管理員', 18000, 115, 'DT-001-2026-03A', '2026/03/03 - 03/21', 30, 12],
            ['DT-001', 'Downtown', '職業安全衛生管理員', 18000, 115, 'DT-001-2026-04A', '2026/04/07 - 04/25', 30, 25],
            ['DT-002', 'Downtown', '甲種業務主管', 8000, 42, 'DT-002-2026-02A', '2026/02/10 - 02/14', 40, 15],
            ['DT-003', 'Downtown', '堆高機操作人員', 4500, 18, 'DT-003-2026-02A', '2026/02/05 - 02/07', 30, 8],
            ['LJ-001', '龍井', '職業安全衛生管理員', 18000, 115, 'LJ-001-2026-03A', '2026/03/10 - 03/28', 25, 18],
            ['LJ-002', '龍井', '甲種業務主管', 8000, 42, 'LJ-002-2026-02A', '2026/02/17 - 02/21', 35, 20],
            ['LJ-003', '龍井', '堆高機操作人員', 4500, 18, 'LJ-003-2026-02A', '2026/02/12 - 02/14', 25, 10]
        ];
        
        sampleCourses.forEach(row => coursesSheet.appendRow(row));
    }
    
    // 建立 Orders sheet
    let ordersSheet = ss.getSheetByName(SHEET_ORDERS);
    if (!ordersSheet) {
        ordersSheet = ss.insertSheet(SHEET_ORDERS);
        ordersSheet.appendRow(['order_id', 'created_at', 'total_amount', 'discount_rate', 'status']);
    }
    
    // 建立 Registrations sheet
    let registrationsSheet = ss.getSheetByName(SHEET_REGISTRATIONS);
    if (!registrationsSheet) {
        registrationsSheet = ss.insertSheet(SHEET_REGISTRATIONS);
        registrationsSheet.appendRow([
            'order_id', 'course_id', 'session_id', 'name', 'id_number_masked',
            'birthdate', 'address', 'phone', 'email', 'education', 'created_at'
        ]);
    }
    
    // 建立 Payments sheet
    let paymentsSheet = ss.getSheetByName(SHEET_PAYMENTS);
    if (!paymentsSheet) {
        paymentsSheet = ss.insertSheet(SHEET_PAYMENTS);
        paymentsSheet.appendRow(['order_id', 'payment_date', 'account_last5', 'amount', 'created_at']);
    }
    
    console.log('Sheets initialized successfully!');
}
