/**
 * 課程報名系統 - API 呼叫封裝
 * 
 * 所有與 Google Apps Script 的通訊都透過此模組
 */

const API = {
    /**
     * 發送請求至 Apps Script
     * 使用 GET 請求避開 CORS preflight 問題
     */
    async request(action, data = {}) {
        try {
            // 建立查詢參數（含 referer 供後端驗證）
            const params = new URLSearchParams({
                token: CONFIG.API_TOKEN,
                action: action,
                data: JSON.stringify(data),
                referer: window.location.origin
            });

            const url = `${CONFIG.API_URL}?${params.toString()}`;

            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || '操作失敗');
            }

            return result;
        } catch (error) {
            console.error('API 請求失敗:', error);
            throw error;
        }
    },

    /**
     * 取得所有課程資料（含梯次與剩餘名額）
     */
    async getCourses() {
        // 若 API 尚未設定，使用本地測試資料
        if (CONFIG.API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
            return this.getLocalCourses();
        }

        const result = await this.request('getCourses');
        return result.data;
    },

    /**
     * 檢查特定梯次的剩餘名額
     */
    async checkQuota(sessionId) {
        if (CONFIG.API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
            return { remaining: 10 }; // 測試用
        }

        const result = await this.request('checkQuota', { session_id: sessionId });
        return result.data;
    },

    /**
     * 送出報名訂單
     * 包含原子化名額扣除
     */
    async submitOrder(orderData) {
        if (CONFIG.API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
            // 測試模式：模擬成功
            return {
                success: true,
                order_id: Utils.generateOrderId()
            };
        }

        const result = await this.request('submitOrder', orderData);
        return result;
    },

    /**
     * 回填匯款資訊
     */
    async submitPayment(paymentData) {
        if (CONFIG.API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
            return { success: true };
        }

        const result = await this.request('submitPayment', paymentData);
        return result;
    },

    /**
     * 本地測試用課程資料
     */
    getLocalCourses() {
        return [
            // Downtown 教室課程
            {
                course_id: 'DT-001',
                location: 'Downtown',
                course_name: '職業安全衛生管理員',
                hours: 115,
                price: 18000,
                sessions: [
                    { session_id: 'DT-001-2026-03A', date: '2026/03/03 - 03/21', quota: 30, remaining: 12 },
                    { session_id: 'DT-001-2026-04A', date: '2026/04/07 - 04/25', quota: 30, remaining: 25 },
                    { session_id: 'DT-001-2026-05A', date: '2026/05/05 - 05/23', quota: 30, remaining: 30 }
                ]
            },
            {
                course_id: 'DT-002',
                location: 'Downtown',
                course_name: '職業安全管理師（安師抵充班）',
                hours: 43,
                price: 8500,
                sessions: [
                    { session_id: 'DT-002-2026-03A', date: '2026/03/10 - 03/14', quota: 25, remaining: 8 },
                    { session_id: 'DT-002-2026-04A', date: '2026/04/14 - 04/18', quota: 25, remaining: 20 }
                ]
            },
            {
                course_id: 'DT-003',
                location: 'Downtown',
                course_name: '甲種業務主管（營造）',
                hours: 42,
                price: 8000,
                sessions: [
                    { session_id: 'DT-003-2026-02A', date: '2026/02/10 - 02/14', quota: 40, remaining: 5 },
                    { session_id: 'DT-003-2026-03A', date: '2026/03/17 - 03/21', quota: 40, remaining: 35 }
                ]
            },
            {
                course_id: 'DT-004',
                location: 'Downtown',
                course_name: '乙種業務主管',
                hours: 35,
                price: 6500,
                sessions: [
                    { session_id: 'DT-004-2026-02A', date: '2026/02/17 - 02/21', quota: 40, remaining: 15 },
                    { session_id: 'DT-004-2026-03A', date: '2026/03/24 - 03/28', quota: 40, remaining: 40 }
                ]
            },
            {
                course_id: 'DT-005',
                location: 'Downtown',
                course_name: '堆高機操作人員',
                hours: 18,
                price: 4500,
                sessions: [
                    { session_id: 'DT-005-2026-02A', date: '2026/02/05 - 02/07', quota: 30, remaining: 3 },
                    { session_id: 'DT-005-2026-02B', date: '2026/02/19 - 02/21', quota: 30, remaining: 18 },
                    { session_id: 'DT-005-2026-03A', date: '2026/03/05 - 03/07', quota: 30, remaining: 30 }
                ]
            },
            {
                course_id: 'DT-006',
                location: 'Downtown',
                course_name: '急救人員',
                hours: 16,
                price: 3200,
                sessions: [
                    { session_id: 'DT-006-2026-02A', date: '2026/02/12 - 02/13', quota: 35, remaining: 10 },
                    { session_id: 'DT-006-2026-03A', date: '2026/03/12 - 03/13', quota: 35, remaining: 28 }
                ]
            },
            {
                course_id: 'DT-007',
                location: 'Downtown',
                course_name: '有機溶劑作業主管',
                hours: 18,
                price: 4000,
                sessions: [
                    { session_id: 'DT-007-2026-02A', date: '2026/02/24 - 02/26', quota: 35, remaining: 20 },
                    { session_id: 'DT-007-2026-03A', date: '2026/03/31 - 04/02', quota: 35, remaining: 35 }
                ]
            },
            {
                course_id: 'DT-008',
                location: 'Downtown',
                course_name: '缺氧作業主管',
                hours: 18,
                price: 4000,
                sessions: [
                    { session_id: 'DT-008-2026-03A', date: '2026/03/10 - 03/12', quota: 30, remaining: 22 }
                ]
            },
            // 龍井教室課程
            {
                course_id: 'LJ-001',
                location: '龍井',
                course_name: '職業安全衛生管理員',
                hours: 115,
                price: 18000,
                sessions: [
                    { session_id: 'LJ-001-2026-03A', date: '2026/03/10 - 03/28', quota: 25, remaining: 18 },
                    { session_id: 'LJ-001-2026-04A', date: '2026/04/14 - 05/02', quota: 25, remaining: 25 }
                ]
            },
            {
                course_id: 'LJ-002',
                location: '龍井',
                course_name: '職業安全管理師（安師抵充班）',
                hours: 43,
                price: 8500,
                sessions: [
                    { session_id: 'LJ-002-2026-03A', date: '2026/03/17 - 03/21', quota: 20, remaining: 12 }
                ]
            },
            {
                course_id: 'LJ-003',
                location: '龍井',
                course_name: '甲種業務主管（營造）',
                hours: 42,
                price: 8000,
                sessions: [
                    { session_id: 'LJ-003-2026-02A', date: '2026/02/17 - 02/21', quota: 35, remaining: 8 },
                    { session_id: 'LJ-003-2026-03A', date: '2026/03/24 - 03/28', quota: 35, remaining: 30 }
                ]
            },
            {
                course_id: 'LJ-004',
                location: '龍井',
                course_name: '丙種業務主管',
                hours: 21,
                price: 4500,
                sessions: [
                    { session_id: 'LJ-004-2026-02A', date: '2026/02/10 - 02/12', quota: 40, remaining: 25 },
                    { session_id: 'LJ-004-2026-03A', date: '2026/03/10 - 03/12', quota: 40, remaining: 40 }
                ]
            },
            {
                course_id: 'LJ-005',
                location: '龍井',
                course_name: '堆高機操作人員',
                hours: 18,
                price: 4500,
                sessions: [
                    { session_id: 'LJ-005-2026-02A', date: '2026/02/12 - 02/14', quota: 25, remaining: 0 },
                    { session_id: 'LJ-005-2026-02B', date: '2026/02/26 - 02/28', quota: 25, remaining: 15 },
                    { session_id: 'LJ-005-2026-03A', date: '2026/03/12 - 03/14', quota: 25, remaining: 25 }
                ]
            },
            {
                course_id: 'LJ-006',
                location: '龍井',
                course_name: '急救人員',
                hours: 16,
                price: 3200,
                sessions: [
                    { session_id: 'LJ-006-2026-02A', date: '2026/02/19 - 02/20', quota: 30, remaining: 5 },
                    { session_id: 'LJ-006-2026-03A', date: '2026/03/19 - 03/20', quota: 30, remaining: 22 }
                ]
            },
            {
                course_id: 'LJ-007',
                location: '龍井',
                course_name: '高空工作車操作人員',
                hours: 16,
                price: 5000,
                sessions: [
                    { session_id: 'LJ-007-2026-03A', date: '2026/03/05 - 03/06', quota: 20, remaining: 14 }
                ]
            },
            {
                course_id: 'LJ-008',
                location: '龍井',
                course_name: '吊籠作業人員',
                hours: 26,
                price: 5500,
                sessions: [
                    { session_id: 'LJ-008-2026-03A', date: '2026/03/17 - 03/20', quota: 20, remaining: 18 }
                ]
            }
        ];
    }
};
