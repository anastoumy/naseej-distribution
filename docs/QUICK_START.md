# Naseej Distribution — Employee Quick Start

## العربية

### بدء التشغيل
1. افتح التطبيق من سطح المكتب أو قائمة ابدأ.
2. اللغة الافتراضية هي العربية. للتبديل إلى الإنجليزية، اضغط **EN** في الشريط العلوي.
3. تأكد من ظهور التاريخ والوقت في الشريط العلوي — هذا يعني أن التطبيق جاهز.

### إتمام عملية بيع (نقطة البيع)
1. من القائمة الجانبية، اختر **البيع** ثم **الكاشير**.
2. اضغط **F1** أو استخدم مربع البحث للعثور على منتج.
3. اضغط على المنتج لإضافته إلى السلة. إذا كان للمنتج نكهات، اختر النكهة المطلوبة.
4. اضغط **F2** أو **إرفاق عميل** واختر العميل (أو أنشئ عميلاً جديداً).
5. أدخل خصماً اختيارياً في حقل الخصم.
6. اضغط **ادفع** أو **F12** لإتمام الدفع.
7. أدخل المبلغ المدفوع الآن:
   - **ادفع كامل المبلغ** للدفع النقدي الكامل.
   - **ادفع لاحقاً (0)** لتسجيل المبلغ كدين على العميل.
8. بعد الإتمام، ستظهر الإيصال — يمكنك إغلاقه والبدء بعملية جديدة.

### اختصارات لوحة المفاتيح
| المفتاح | الإجراء |
|---------|---------|
| F1 | التركيز على بحث المنتجات |
| F2 | إرفاق عميل |
| F12 | فتح شاشة الدفع |
| Esc | إغلاق النافذة المفتوحة |

### إدارة الديون
1. من القائمة الجانبية، اختر **العمليات** ثم **الديون**.
2. اختر العميل لعرض رصيده والفواتير المفتوحة.
3. اضغط **تحصيل** لتسجيل دفعة من العميل.

### النسخ الاحتياطي
1. اذهب إلى **الإعدادات**.
2. اضغط **إنشاء نسخة احتياطية** لحفظ قاعدة البيانات محلياً.
3. استخدم **استعادة** فقط عند الحاجة — سيتم استبدال جميع البيانات الحالية.

### التحديثات
- يتحقق التطبيق تلقائياً من التحديثات عند التشغيل.
- عند توفر تحديث، سيظهر إشعار — حمّل التحديث ثم أعد التشغيل عند الطلب.

---

## English

### Getting started
1. Open the app from the desktop or Start menu shortcut.
2. Default language is Arabic. Tap **EN** in the top bar to switch to English.
3. Confirm the date and time appear in the status bar — the app is ready.

### Completing a sale (Register)
1. In the sidebar, open **Sales** → **Register**.
2. Press **F1** or use the search box to find a product.
3. Tap a product to add it to the cart. Pick a flavor when prompted.
4. Press **F2** or **Attach Customer** and select (or create) a customer.
5. Optionally enter a discount.
6. Press **PAY** or **F12** to open payment.
7. Enter the amount paid now:
   - **Pay Full Amount** for cash sales.
   - **Pay Later (0)** to record the balance as customer debt.
8. Review the receipt, then close it to start the next sale.

### Keyboard shortcuts
| Key | Action |
|-----|--------|
| F1 | Focus product search |
| F2 | Attach customer |
| F12 | Open payment |
| Esc | Close the active dialog |

### Managing debts
1. Sidebar → **Operations** → **Debts**.
2. Select a customer to view balance and open invoices.
3. Use **Collect** to record a payment.

### Backups
1. Open **Settings**.
2. Click **Create backup** to save the database locally.
3. Use **Restore** only when needed — it replaces all current data.

### Updates
- The app checks for updates shortly after launch.
- When an update is available, download it and restart when prompted.

---

## Building installers (IT)

```bash
npm run build
npm run package:mac   # macOS DMG + ZIP
npm run package:win     # Windows NSIS installer
```

**Code signing**
- macOS: set `CSC_LINK` and `CSC_KEY_PASSWORD`
- Windows: set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`

**Staging updates:** set `UPDATE_CHANNEL=staging` before packaging to use the staging release channel.
