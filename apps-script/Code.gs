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

const SHEET_ID = '1knWuxEmq-LEZmMuxmGxWhj1IvvxOPE7yXXbOkuGBCNo';
const TOKEN = 'isha-course-api-2026';

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
 * 處理 GET 請求
 */
function doGet(e) {
    try {
        const params = e.parameter;
        const token = params.token;
        const action = params.action;
        const data = params.data ? JSON.parse(params.data) : {};
        
        // Token 驗證
        if (token !== TOKEN) {
            return jsonResponse({ success: false, error: 'Unauthorized' });
        }
        
        // 路由
        switch (action) {
            case 'getCourses':
                return getCourses();
            case 'checkQuota':
                return checkQuota(data.session_id);
            case 'submitOrder':
                return submitOrder(data);
            case 'submitPayment':
                return submitPayment(data);
            default:
                return jsonResponse({ success: true, message: 'API is running' });
        }
        
    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: error.message });
    }
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

// ============================================
// 課程自動同步功能
// ============================================

/**
 * 課程來源設定
 * 每個課程類型對應 isha.org.tw 的查詢 key
 */
const COURSE_SOURCES = {
    // Downtown (復興/忠明) 教室 - UnitCd=H001
    'Downtown': [
        { name: '職業安全衛生管理員', hours: 115, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeiBt+alreWuieWFqOihm+eUn+euoeeQhuWToeWuiSUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
        { name: '職業安全管理師', hours: 43, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeiBt+alreWuieWFqOeuoeeQhuW4q+WuieWFqOihmyUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
        { name: '職業衛生管理師', hours: 59, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeiBt+alreihm+eUn+euoeeQhuW4q+WuieWFqOihmyUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
        { name: '甲種業務主管', hours: 42, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeeUsueoruiBt+alreWuieWFqOihm+eUn+alreWLmSUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
        { name: '乙種業務主管', hours: 35, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeS5meeoruiBt+alreWuieWFqOihm+eUn+alreWLmSUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
        { name: '丙種業務主管', hours: 21, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeS4meeoruiBt+alreWuieWFqOihm+eUn+alreWLmSUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
        { name: '健康服務護理人員', hours: 52, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXorbfnkIYlJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '急救人員', hours: 16, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmgKXmlZElJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '有機溶劑作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmnInmqZ8lJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '特定化學物質作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXnibnlrprljJblrbglJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '粉塵作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXnsonlobUlJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '缺氧作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXnvLrmsKclJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '堆高機操作人員', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXloIbpq5jmqZ8lJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '三公噸以上固定式起重機地面操作', hours: 38, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeWcsOmdoiUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
        { name: '三公噸以上移動式起重機', hours: 38, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXkuInlhazlmbjku6XkuIrkuYvnp7vli5XlvI/otbclJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '未滿三公噸固定式起重機操作', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlkIrljYfojbfph43lnKjpm7bpu57kupTlhazlmbglJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '使用起重機具從事吊掛作業人員', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlkIrmjpslJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '高空工作車操作人員', hours: 16, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXpq5jnqbolJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '屋頂作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlsYvpoIIlJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '施工架組配作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmlr3lt6XmnrYlJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '擋土支撐作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmk4vlnJ8lJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '露天開挖作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXpnLLlpKklJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '模板支撐作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmqKHmnb8lJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '鋼構組配作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXpi7zmp4slJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '施工安全評估人員', hours: 76, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmlr3lt6XlronlhajoqZXkvLAlJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '製程安全評估人員', hours: 82, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXoo73nqIslJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '吊籠作業人員', hours: 26, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlkIrnsaAlJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '防火管理人', hours: 12, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXpmLLngaslJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '乙炔熔接', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXkuZnngpQlJyBhbmQgVW5pdENkPSdIMDAxJw==' },
        { name: '高壓氣體製造主任', hours: 22, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeS4u+S7uyUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
        { name: '高壓氣體製造作業主管', hours: 21, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJemrmOWjk+awo+mrlOijvemAoOWuieWFqOS9nOalrSUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
        { name: '高壓氣體供應及消費作業主管', hours: 21, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJemrmOWjk+awo+mrlOS+m+aHiSUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
        { name: '一般安全衛生', hours: 6, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeS4gOiIrCUnIGFuZCBVbml0Q2Q9J0gwMDEn' },
    ],
    // 龍井教室 - UnitCd=Y001
    '龍井': [
        { name: '職業安全衛生管理員', hours: 115, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXnrqHnkIblk6ElJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '職業安全管理師', hours: 43, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlronlhajnrqHnkIbluKslJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '職業衛生管理師', hours: 59, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXooZvnlJ/nrqHnkIbluKslJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '甲種業務主管', hours: 42, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXnlLLnqK4lJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '丙種業務主管', hours: 21, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXkuJnnqK4lJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '健康服務護理人員', hours: 52, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXorbfnkIYlJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '急救人員', hours: 16, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmgKXmlZElJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '有機溶劑作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmnInmqZ8lJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '特定化學物質作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXljJblrbglJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '粉塵作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXnsonlobUlJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '缺氧作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXnvLrmsKclJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '堆高機操作人員', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXloIbpq5jmqZ8lJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '三公噸以上固定式起重機地面操作', hours: 38, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlnLDpnaIlJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '三公噸以上固定式起重機機上操作', hours: 38, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmqZ/kuIolJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '三公噸以上移動式起重機', hours: 38, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXnp7vli5UlJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '未滿三公噸固定式起重機操作', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlkIrljYfojbfph43lnKjpm7bpu57kupTlhazlmbglJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '使用起重機具從事吊掛作業人員', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlkIrmjpslJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '高空工作車操作人員', hours: 16, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXpq5jnqbolJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '屋頂作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlsYvpoIIlJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '施工架組配作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmlr3lt6XmnrYlJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '擋土支撐作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmk4vlnJ8lJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '露天開挖作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXpnLLlpKklJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '模板支撐作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXmqKHmnb8lJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '鋼構組配作業主管', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXpi7zmp4slJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '高壓氣體容器操作人', hours: 35, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXpq5jlo5PmsKPpq5Tlrrnlmajmk40lJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '高壓氣體特定設備', hours: 35, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXpq5jlo5PmsKPpq5TnibnlrpolJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '第一種壓力容器', hours: 35, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXnrKzkuIAlJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '乙炔熔接裝置', hours: 18, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXkuZnngpQlJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '吊籠作業人員', hours: 26, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlkIrnsaAlJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '高壓氣體供應及消費作業主管', hours: 21, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJemrmOWjk+awo+mrlOS+m+aHieWPiua2iOiyu+S9nCUnIGFuZCBVbml0Q2Q9J1kwMDEn' },
        { name: '高壓氣體製造安全作業主管', hours: 21, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeijvemAoCUnIGFuZCBVbml0Q2Q9J1kwMDEn' },
        { name: '隧道等挖掘作業主管', hours: 18, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJemap+mBk+etieaMluaOmOS9nOalrSUnIGFuZCBVbml0Q2Q9J1kwMDEn' },
        { name: '隧道等襯砌作業主管', hours: 18, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJemap+mBk+etieilr+egjCUnIGFuZCBVbml0Q2Q9J1kwMDEn' },
        { name: '一般安全衛生', hours: 6, key: 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeS4gOiIrCUnIGFuZCBVbml0Q2Q9J1kwMDEn' },
        { name: '防火管理人', hours: 12, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXpmLLngaslJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '危險物品運送罐槽車', hours: 20, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXnvZDmp70lJyBhbmQgVW5pdENkPSdZMDAxJw==' },
        { name: '危險物品運送其他貨車', hours: 16, key: 'IGFuZCAoQ2xzVHlwZUNEPD4nMTQnIEFORCBDb3VyTmFtZSBOT1QgbGlrZSAnJeikh+iokyUnKSBhbmQgQ291ck5hbWUgbGlrZSBOJyXlhbbku5YlJyBhbmQgVW5pdENkPSdZMDAxJw==' },
    ]
};

/**
 * 同步課程資料（從 isha.org.tw 抓取）
 * 可手動執行或設定定時觸發
 */
function syncCourses() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let coursesSheet = ss.getSheetByName(SHEET_COURSES);
    
    // 若不存在則建立
    if (!coursesSheet) {
        coursesSheet = ss.insertSheet(SHEET_COURSES);
        coursesSheet.appendRow([
            'course_id', 'location', 'course_name', 'price', 'hours',
            'session_id', 'date', 'quota', 'remaining'
        ]);
    }
    
    // 清除舊資料（保留標題列）
    const lastRow = coursesSheet.getLastRow();
    if (lastRow > 1) {
        coursesSheet.deleteRows(2, lastRow - 1);
    }
    
    let courseIdCounter = 1;
    
    // 遍歷所有教室和課程
    for (const [location, courses] of Object.entries(COURSE_SOURCES)) {
        for (const courseInfo of courses) {
            try {
                const sessions = fetchCourseSessions(courseInfo.key);
                
                if (sessions.length === 0) continue;
                
                const courseId = `${location === 'Downtown' ? 'DT' : 'LJ'}-${String(courseIdCounter).padStart(3, '0')}`;
                
                for (const session of sessions) {
                    coursesSheet.appendRow([
                        courseId,
                        location,
                        courseInfo.name,
                        session.price,
                        courseInfo.hours,
                        session.sessionId,
                        session.date,
                        session.quota,
                        session.remaining
                    ]);
                }
                
                courseIdCounter++;
                
                // 避免過度請求
                Utilities.sleep(500);
                
            } catch (error) {
                console.error(`Error fetching ${courseInfo.name}:`, error);
            }
        }
    }
    
    console.log('課程同步完成！');
}

/**
 * 從 isha.org.tw 抓取指定課程的梯次資料
 */
function fetchCourseSessions(key) {
    const url = `https://isha.org.tw/Msite/tech/serch.aspx?key=${key}`;
    
    try {
        const response = UrlFetchApp.fetch(url, {
            muteHttpExceptions: true,
            followRedirects: true
        });
        
        const html = response.getContentText();
        
        // 除錯：印出 HTML 中是否包含關鍵字
        const hasWorkLogID = html.includes('WorkLogID');
        const has開課日期 = html.includes('開課日期');
        const has課程費用 = html.includes('課程費用');
        console.log(`URL: ${url.substring(0, 80)}...`);
        console.log(`  WorkLogID: ${hasWorkLogID}, 開課日期: ${has開課日期}, 課程費用: ${has課程費用}`);
        
        // 嘗試找一段包含課程資訊的文字
        const sampleMatch = html.match(/開課日期[：:].{20}/);
        if (sampleMatch) {
            console.log(`  Sample: ${sampleMatch[0]}`);
        }
        
        return parseCourseSessions(html);
        
    } catch (error) {
        console.error('Fetch error:', error);
        return [];
    }
}

/**
 * 解析 HTML 取得課程梯次資料
 */
function parseCourseSessions(html) {
    const sessions = [];
    
    // 實際格式：
    // WorkLogID=11402H001007' ... 開課日期：</h3><h3>1150202-1150422</h3> ... 課程費用：</h3><h3>13,000元</h3>
    const blockPattern = /WorkLogID=(\w+)'[\s\S]*?開課日期：<\/h3><h3>(\d{7})-(\d{7})<\/h3>[\s\S]*?課程費用：<\/h3><h3>([\d,]+)元<\/h3>/g;
    
    let match;
    let count = 0;
    while ((match = blockPattern.exec(html)) !== null) {
        const workLogId = match[1];
        const startDate = formatROCDate(match[2]);
        const endDate = formatROCDate(match[3]);
        const price = parseInt(match[4].replace(/,/g, ''));
        
        if (count < 3) {
            console.log(`  Matched: ${workLogId}, ${startDate}-${endDate}, $${price}`);
        }
        count++;
        
        sessions.push({
            sessionId: workLogId,
            date: `${startDate} - ${endDate}`,
            price: price,
            quota: 30,
            remaining: 30
        });
    }
    
    console.log(`  Total matched: ${count} sessions`);
    return sessions;
}

/**
 * 測試用：抓取單一課程驗證
 */
function testSingleCourse() {
    const testKey = 'IGFuZCBDb3VyTmFtZSBsaWtlIE4nJeiBt+alreWuieWFqOihm+eUn+euoeeQhuWToeWuiSUnIGFuZCBVbml0Q2Q9J0gwMDEn';
    const url = `https://isha.org.tw/Msite/tech/serch.aspx?key=${testKey}`;
    
    const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true
    });
    
    const html = response.getContentText();
    console.log('HTML length:', html.length);
    
    // 直接測試正則表達式
    const pattern = /WorkLogID=(\w+)'[\s\S]*?開課日期：<\/h3><h3>(\d{7})-(\d{7})<\/h3>[\s\S]*?課程費用：<\/h3><h3>([\d,]+)元<\/h3>/g;
    
    let match;
    let count = 0;
    while ((match = pattern.exec(html)) !== null && count < 5) {
        console.log(`Match ${count + 1}: WorkLogID=${match[1]}, Date=${match[2]}-${match[3]}, Price=${match[4]}`);
        count++;
    }
    
    console.log(`Total found: ${count} matches`);
}

/**
 * 解析多種日期格式
 */
function parseDateString(dateStr) {
    // 格式1: YYYMMDD-YYYMMDD (如 1150131-1150426)
    if (/^\d{7}-\d{7}$/.test(dateStr)) {
        const start = dateStr.substring(0, 7);
        const end = dateStr.substring(8);
        return `${formatROCDate(start)} - ${formatROCDate(end)}`;
    }
    
    // 格式2: YYY.MM.DD (如 115.01.22)
    if (/^\d{3}\.\d{2}\.\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const year = parseInt(parts[0]) + 1911;
        return `${year}/${parts[1]}/${parts[2]}`;
    }
    
    // 格式3: YYY/MM/DD-YYY/MM/DD
    if (/^\d{3}\/\d{2}\/\d{2}-\d{3}\/\d{2}\/\d{2}$/.test(dateStr)) {
        const [start, end] = dateStr.split('-');
        const startParts = start.split('/');
        const endParts = end.split('/');
        const startYear = parseInt(startParts[0]) + 1911;
        const endYear = parseInt(endParts[0]) + 1911;
        return `${startYear}/${startParts[1]}/${startParts[2]} - ${endYear}/${endParts[1]}/${endParts[2]}`;
    }
    
    // 其他格式直接返回
    return dateStr;
}

/**
 * 將民國年日期 (YYYMMDD) 轉換為 YYYY/MM/DD 格式
 */
function formatROCDate(rocDate) {
    const year = parseInt(rocDate.substring(0, 3)) + 1911;
    const month = rocDate.substring(3, 5);
    const day = rocDate.substring(5, 7);
    return `${year}/${month}/${day}`;
}

/**
 * 從 HTML 文字推估剩餘名額
 */
function estimateRemaining(html, workLogId) {
    // 找到該梯次附近的文字
    const pattern = new RegExp(`WorkLogID=${workLogId}[\\s\\S]{0,500}`, 'i');
    const match = html.match(pattern);
    
    if (!match) return 30;
    
    const context = match[0];
    
    if (context.includes('額滿') && !context.includes('即將額滿')) {
        return 0;
    } else if (context.includes('即將額滿')) {
        return 3;
    } else if (context.includes('名額有限')) {
        return 10;
    } else {
        return 30;
    }
}

/**
 * 設定每日自動同步（需手動執行一次來建立觸發器）
 */
function setupDailySync() {
    // 移除舊的觸發器
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
        if (trigger.getHandlerFunction() === 'syncCourses') {
            ScriptApp.deleteTrigger(trigger);
        }
    }
    
    // 建立新觸發器：每天凌晨 3 點執行
    ScriptApp.newTrigger('syncCourses')
        .timeBased()
        .atHour(3)
        .everyDays(1)
        .create();
    
    console.log('每日同步觸發器已設定！');
}
