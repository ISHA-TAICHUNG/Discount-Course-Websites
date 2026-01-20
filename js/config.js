/**
 * 課程報名系統 - 設定檔
 * 
 * ⚠️ 資安注意：
 * - API_TOKEN 應保持機密，部署前請更換為正式 token
 * - 此檔案會公開於 GitHub Pages，請勿存放敏感資訊
 */

const CONFIG = {
    // Google Apps Script Web App URL
    // 部署 Apps Script 後，將 URL 貼至此處
    API_URL: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
    
    // API Token（需與 Apps Script 端設定一致）
    API_TOKEN: 'YOUR_SECURE_TOKEN_HERE',
    
    // 匯款資訊
    BANK_INFO: {
        bank_name: '合作金庫銀行',
        bank_code: '006',
        branch: '台中分行',
        account_number: '1234-567-890123',
        account_name: '○○職業訓練中心'
    },
    
    // 匯款期限（天數）
    PAYMENT_DEADLINE_DAYS: 1,
    
    // 優惠設定
    DISCOUNT: {
        rate: 0.8,  // 8折
        min_courses: 2,      // 最少課程數觸發
        min_persons: 2       // 最少人數觸發
    },
    
    // 學歷選項
    EDUCATION_OPTIONS: [
        '國中（含以下）',
        '高中職',
        '專科',
        '大學',
        '碩士',
        '博士'
    ],
    
    // 驗證規則
    VALIDATION: {
        // 身分證正則（台灣身分證格式）
        id_pattern: /^[A-Z][12]\d{8}$/,
        // 手機正則
        phone_pattern: /^09\d{8}$/,
        // Email 正則
        email_pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        // 民國年日期正則 (YYY/MM/DD)
        birthdate_pattern: /^(0[0-9]{2}|1[0-1][0-9])\/([0][1-9]|1[0-2])\/([0][1-9]|[12][0-9]|3[01])$/
    }
};

// 防止意外修改
Object.freeze(CONFIG);
Object.freeze(CONFIG.BANK_INFO);
Object.freeze(CONFIG.DISCOUNT);
Object.freeze(CONFIG.VALIDATION);
