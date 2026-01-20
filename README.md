# 初訓課程報名系統

職業安全衛生初訓課程報名網站，純前端靜態網站，可部署於 GitHub Pages。

## 功能特色

- 📚 課程列表與篩選
- 🛒 購物車功能
- 🎁 自動優惠計算（8 折）
- 📝 多人報名表單
- 💳 繳費資訊顯示
- 🔒 個資保護機制

## 優惠條件

符合以下任一條件即享 8 折優惠：
- 購物車內有 2 門（含）以上不同課程
- 同一課程報名人數 ≥ 2 人

## 技術架構

- **前端**：HTML5 + CSS3 + Vanilla JavaScript
- **後端**：Google Apps Script
- **資料庫**：Google Sheets
- **部署**：GitHub Pages

## 部署說明

1. 設定 Google Sheet 並部署 Apps Script
2. 修改 `js/config.js` 中的 API URL 與 Token
3. 推送至 GitHub 並啟用 GitHub Pages

## 檔案結構

```
├── index.html          # 課程列表
├── cart.html           # 購物車
├── registration.html   # 報名表單
├── payment.html        # 繳費資訊
├── css/style.css       # 樣式
├── js/                 # JavaScript
└── apps-script/        # Google Apps Script
```

## 授權

MIT License
