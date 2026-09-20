
// The AMIRI_FONT_BASE64 import is removed as we now link to Google Fonts directly
// import { AMIRI_FONT_BASE64 } from './amiriFont';

/**
 * Generates a comprehensive Word document (HTML format) as a guide for the Supervisor Dashboard.
 * Includes detailed explanations of each section with placeholders for screenshots.
 */
export const exportSupervisorGuideWord = (fileName: string = 'دليل_المشرف_إعداد_حافظ') => {
  const date = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const contentSections = [
    {
      title: 'مقدمة لوحة تحكم المشرف',
      body: `
        <p>تعتبر لوحة تحكم المشرف هي المركز الرئيسي لإدارة ومتابعة جميع جوانب برنامج "إعداد حافظ". من خلالها، يمكنك الوصول إلى التقارير والإحصاءات، إدارة الطلاب والمعلمين والحلقات، إعدادات التطبيق، ونظرة عامة على البيانات.</p>
        <p>تم تحسين واجهة المستخدم لتكون أكثر وضوحاً وسهولة في الاستخدام، مع خطوط أكبر وخلفيات متباينة الألوان في القوائم لتسهيل القراءة والاختيار.</p>
        <p>هذا الدليل سيأخذك في جولة مفصلة عبر كل قسم، موضحاً كيفية الاستفادة القصوى من الأدوات المتاحة.</p>
        <p style="text-align: center; margin-top: 20px;"><img src="https://via.placeholder.com/800x400?text=لقطة+شاشة:+لوحة+تحكم+المشرف+-+نظرة+عامة" alt="لقطة شاشة: لوحة تحكم المشرف - نظرة عامة" style="max-width: 100%; height: auto; border: 1px solid #ddd;"/></p>
      `
    },
    {
      title: 'قسم التقارير والإحصاءات',
      body: `
        <p>يوفر هذا القسم نظرة شاملة على أداء الطلاب والحلقات، مع إحصائيات سريعة وتقارير تفصيلية.</p>
        <h4>الإحصاءات الرئيسية (Dashboard Stats)</h4>
        <p>تظهر في الجزء العلوي من لوحة التحكم، وتقدم لك ملخصاً سريعاً لأهم المؤشرات مثل:</p>
        <ul>
            <li><strong>إجمالي الطلاب:</strong> عدد الطلاب المسجلين في البرنامج.</li>
            <li><strong>نسبة الحضور:</strong> متوسط نسبة حضور الطلاب في التقييمات المسجلة.</li>
            <li><strong>التقييمات الممتازة:</strong> عدد التقييمات التي حصل فيها الطلاب على مستوى "ممتاز".</li>
            <li><strong>تقييمات الأسبوع الحالي:</strong> عدد التقييمات التي تم إدخالها للأسبوع الأخير.</li>
        </ul>
        <p style="text-align: center; margin-top: 20px;"><img src="https://via.placeholder.com/800x300?text=لقطة+شاشة:+إحصاءات+لوحة+التحكم" alt="لقطة شاشة: إحصاءات لوحة التحكم" style="max-width: 100%; height: auto; border: 1px solid #ddd;"/></p>
        
        <h4>جدول التقارير (Reports Table)</h4>
        <p>يتيح لك هذا الجدول عرض التقييمات بمرونة عالية، مع خيارات تصفية وفرز متعددة:</p>
        <ul>
            <li><strong>خيارات التصفية:</strong>
                <ul>
                    <li><strong>تصفية حسب الطالب:</strong> اختر طالباً محدداً لعرض تقييماته.</li>
                    <li><strong>تصفية حسب الحلقة:</strong> اختر حلقة لعرض تقييمات طلابها.</li>
                    <li><strong>تصفية حسب المعلم:</strong> اختر معلماً لعرض تقييمات طلاب الحلقات التي يشرف عليها.</li>
                    <li><strong>تصفية حسب الأسبوع:</strong> عرض التقييمات لأسبوع محدد أو جميع الأسابيع.</li>
                    <li><strong>حالة الحضور:</strong> تصفية حسب حالة الحضور (حاضر، غائب، لم يسجل).</li>
                    <li><strong>مستوى الأداء:</strong> تصفية حسب مستوى أداء الحفظ (ممتاز، جيد جداً، لم يحفظ، إلخ).</li>
                    <li style="color: #006A4E; font-weight: bold;">ميزة جديدة: جميع قوائم التصفية تحتوي على خانة بحث لتسهيل الوصول السريع إلى الخيار المطلوب.</li>
                </ul>
            </li>
            <li><strong>الفرز:</strong> يمكنك الفرز تصاعدياً أو تنازلياً بالنقر على رأس أي عمود (مثل: الاسم، الأسبوع، الحلقة).</li>
            <li><strong>تصدير البيانات:</strong>
                <ul>
                    <li><p><strong>تنزيل (Excel):</strong> لتصدير البيانات المفلترة في الجدول إلى ملف Excel للمزيد من التحليل.</p></li>
                    <li><p><strong>تنزيل (Word):</strong> لتصدير البيانات المفلترة في الجدول إلى ملف Word لطباعتها أو حفظها كتقرير نصي.</p></li>
                </ul>
            </li>
        </ul>
        <p style="text-align: center; margin-top: 20px;"><img src="https://via.placeholder.com/800x400?text=لقطة+شاشة:+جدول+التقارير+وخيارات+التصفية" alt="لقطة شاشة: جدول التقارير وخيارات+التصفية" style="max-width: 100%; height: auto; border: 1px solid #ddd;"/></p>
      `
    },
    {
      title: 'قسم الإدارة',
      body: `
        <p>هذا القسم مخصص لإدارة الطلاب، الحلقات، والمعلمين في البرنامج.</p>
        <h4>إدارة الطلاب والحلقات (Student Management)</h4>
        <p>من هنا يمكنك:</p>
        <ul>
            <li><strong>إضافة طلاب جدد:</strong> اختر حلقة، ثم أدخل أسماء الطلاب. يمكنك لصق عدة أسماء في أسطر منفصلة لإضافتها دفعة واحدة.</li>
            <li><strong>تعديل الطلاب:</strong> تعديل اسم الطالب، أو نقله إلى حلقة أخرى.</li>
            <li><strong>حذف الطلاب:</strong> حذف طالب معين، مع حذف جميع تقييماته المرتبطة به.</li>
            <li><strong>إضافة حلقات جديدة:</strong> إضافة حلقة باسم جديد (يمكنك إضافة عدة حلقات في أسطر منفصلة).</li>
            <li><strong>تعديل الحلقات:</strong> تغيير اسم الحلقة، أو تعيين/تغيير المعلم المسؤول عنها.</li>
            <li><strong>حذف الحلقات:</strong> حذف حلقة معينة. سيتم إلغاء تعيين الطلاب منها.</li>
            <li><strong>تصدير بيانات الطلاب:</strong> يمكنك تصدير بيانات الطلاب لحلقة محددة أو لجميع الحلقات إلى ملفات Excel أو Word.</li>
        </ul>
        <p style="text-align: center; margin-top: 20px;"><img src="https://via.placeholder.com/800x400?text=لقطة+شاشة:+إدارة+الطلاب+والحلقات" alt="لقطة شاشة: إدارة الطلاب والحلقات" style="max-width: 100%; height: auto; border: 1px solid #ddd;"/></p>
        
        <h4>إدارة المعلمين (Teacher Management)</h4>
        <p>من هنا يمكنك:</p>
        <ul>
            <li><strong>إضافة معلمين جدد:</strong> أدخل أسماء المعلمين الجدد (يمكنك إضافة عدة أسماء في أسطر منفصلة).</li>
            <li><strong>تعديل المعلمين:</strong> تعديل اسم المعلم.</li>
            <li><strong>حذف المعلمين:</strong> حذف معلم معين. سيتم إلغاء تعيينه من جميع الحلقات التي كان مسؤولاً عنها.</li>
            <li><strong>إدارة الحلقات للمعلم:</strong> زر خاص يفتح نافذة لإدارة الحلقات المعينة لمعلم محدد، حيث يمكنك إضافة أو إزالة الحلقات من قائمة المعلم.</li>
        </ul>
        <p style="text-align: center; margin-top: 20px;"><img src="https://via.placeholder.com/800x400?text=لقطة+شاشة:+إدارة+المعلمين" alt="لقطة شاشة: إدارة المعلمين" style="max-width: 100%; height: auto; border: 1px solid #ddd;"/></p>
      `
    },
    {
      title: 'قسم الإعدادات',
      body: `
        <p>يحتوي هذا القسم على خيارات مهمة لإدارة التطبيق بشكل عام، بما في ذلك الأمان، المزامنة، والنسخ الاحتياطي.</p>
        <h4>إدارة الرقم السري للمشرف</h4>
        <p>يمكنك تغيير الرقم السري الخاص بحساب المشرف لضمان أمان البيانات.</p>
        <p style="text-align: center; margin-top: 20px;"><img src="https://via.placeholder.com/600x250?text=لقطة+شاشة:+تغيير+الرقم+السري" alt="لقطة شاشة: تغيير الرقم السري" style="max-width: 100%; height: auto; border: 1px solid #ddd;"/></p>

        <h4>إدارة رابط Google Script</h4>
        <p>هنا يمكنك تعيين أو مسح رابط Google Script Web App الخاص بك، والذي يستخدم لمزامنة البيانات سحابياً. هذا يسمح لك وللمعلمين بالعمل على نفس البيانات المشتركة.</p>
        <p style="text-align: center; margin-top: 20px;"><img src="https://via.placeholder.com/600x200?text=لقطة+شاشة:+إعداد+Google+Script" alt="لقطة شاشة: إعداد Google Script" style="max-width: 100%; height: auto; border: 1px solid #ddd;"/></p>

        <h4>تخصيص الشعار</h4>
        <p>يمكنك تحميل شعار مخصص ليظهر في رأس التطبيق بدلاً من الشعار الافتراضي. لديك أيضاً خيار إزالة الشعار المخصص للعودة إلى الافتراضي.</p>
        <p style="text-align: center; margin-top: 20px;"><img src="https://via.placeholder.com/600x200?text=لقطة+شاشة:+تخصيص+الشعار" alt="لقطة شاشة: تخصيص الشعار" style="max-width: 100%; height: auto; border: 1px solid #ddd;"/></p>

        <h4>إدارة بيانات التطبيق</h4>
        <p>يحتوي هذا القسم على أدوات قوية للتعامل مع بيانات التطبيق:</p>
        <ul>
            <li><strong>توزيع نسخة التطبيق:</strong>
                <ul>
                    <li><strong>نسخة فارغة:</strong> تنزيل ملف HTML يحتوي على التطبيق فارغاً بدون أي بيانات.</li>
                    <li><strong>نسخة متصلة:</strong> تنزيل ملف HTML يحتوي على التطبيق مع بياناتك الحالية ومتصل برابط Google Script الخاص بك. يمكن توزيعها على المعلمين.</li>
                </ul>
            </li>
            <li><strong>استيراد/تصدير الطلاب والحلقات (قالب Excel):</strong>
                <ul>
                    <li><strong>تنزيل قالب الاستيراد (Excel):</strong> للحصول على قالب Excel لملء بيانات الطلاب والحلقات ثم استيرادها دفعة واحدة.</li>
                    <li><strong>استيراد من ملف Excel:</strong> لاستيراد الطلاب والحلقات من ملف Excel معد مسبقاً (سيحل محل الحلقات والطلاب الحالية).</li>
                </ul>
            </li>
            <li><strong>نسخة احتياطية كاملة واستعادة:</strong>
                <ul>
                    <li><strong>تصدير نسخة احتياطية كاملة:</strong> تنزيل ملف Excel يحتوي على جميع بيانات التطبيق (مستخدمين، حلقات، طلاب، تقييمات، شعار، كلمة سر المشرف).</li>
                    <li><strong>استعادة من نسخة احتياطية كاملة:</strong> لاستيراد جميع البيانات من ملف نسخة احتياطية (سيحل محل جميع البيانات الحالية).</li>
                    <li><strong>تحميل بيانات افتراضية:</strong> لملء التطبيق ببيانات وهمية للاختبار أو التجربة (تحذير: سيمسح جميع البيانات الحالية).</li>
                </ul>
            </li>
            <li><strong>حذف البيانات وإعادة ضبط البرنامج:</strong>
                <ul>
                    <li><strong>حذف جميع التقييمات فقط:</strong> مسح جميع سجلات التقييم مع الاحتفاظ بالطلاب والمعلمين والحلقات.</li>
                    <li><strong>إعادة ضبط البرنامج بالكامل:</strong> مسح جميع البيانات (الطلاب، الحلقات، التقييمات، الشعار، يعيد الرقم السري للمشرف إلى 1234). لا يمكن التراجع عن هذا الإجراء.</li>
                </ul>
            </li>
        </ul>
        <p style="text-align: center; margin-top: 20px;"><img src="https://via.placeholder.com/800x600?text=لقطة+شاشة:+إدارة+البيانات+والنسخ+الاحتياطي" alt="لقطة شاشة: إدارة البيانات والنسخ الاحتياطي" style="max-width: 100%; height: auto; border: 1px solid #ddd;"/></p>
      `
    },
    {
      title: 'قسم نظرة عامة على البيانات (Overview Table)',
      body: `
        <p>هذا القسم يقدم جدولاً موحداً يعرض جميع الطلاب، الحلقات التي ينتمون إليها، والمعلمين المسؤولين عن تلك الحلقات في مكان واحد. هذا مفيد للحصول على رؤية سريعة وشاملة.</p>
        <ul>
            <li><strong>بحث شامل:</strong> يمكنك البحث عن الطلاب أو الحلقات أو المعلمين بسهولة.</li>
            <li><strong>فرز الأعمدة:</strong> انقر على رأس أي عمود لفرز البيانات تصاعدياً أو تنازلياً.</li>
            <li><strong>تصدير البيانات:</strong>
                <ul>
                    <li><p><strong>تنزيل (Excel):</strong> لتصدير البيانات المفلترة في الجدول إلى ملف Excel للمزيد من التحليل.</p></li>
                    <li><p><strong>تنزيل (Word):</strong> لتصدير البيانات المفلترة في الجدول إلى ملف Word لطباعتها أو حفظها كتقرير نصي.</p></li>
                </ul>
            </li>
        </ul>
        <p style="text-align: center; margin-top: 20px;"><img src="https://via.placeholder.com/800x400?text=لقطة+شاشة:+جدول+نظرة+عامة+على+البيانات" alt="لقطة شاشة: جدول نظرة عامة على البيانات" style="max-width: 100%; height: auto; border: 1px solid #ddd;"/></p>
      `
    },
    {
      title: 'خاتمة',
      body: `
        <p>نأمل أن يكون هذا الدليل قد قدم لك فهماً واضحاً وشاملاً لكيفية استخدام لوحة تحكم المشرف في برنامج "إعداد حافظ". إذا كانت لديك أي أسئلة أخرى، فلا تتردد في طلب المساعدة.</p>
        <p>شكراً لاستخدامك برنامجنا ونتمنى لك كل التوفيق في إدارة حلقات التحفيظ.</p>
      `
    }
  ];

  // Construct HTML table with inline styles for Word compatibility
  let htmlContent = `
    <html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <title>${fileName}</title>
        <!-- Link to Google Fonts for Tajawal to ensure consistent Arabic rendering -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
            /* Use Tajawal font directly from Google Fonts */
            body { 
                font-family: 'Tajawal', sans-serif; 
                line-height: 1.6; 
                color: #333; 
                direction: rtl; 
                text-align: right;
                margin: 40px; /* Page margins */
            }
            h1 { 
                text-align: center; 
                color: #006A4E; 
                font-size: 24pt; 
                margin-bottom: 30px; 
                border-bottom: 2px solid #006A4E;
                padding-bottom: 10px;
            }
            h2 { 
                color: #006A4E; 
                font-size: 18pt; 
                margin-top: 40px; 
                margin-bottom: 15px; 
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
            }
            h3 { 
                color: #008000; /* Darker green for sub-sections */
                font-size: 16pt; 
                margin-top: 30px; 
                margin-bottom: 10px;
            }
            h4 { 
                color: #4CAF50; /* Medium green for smaller titles */
                font-size: 14pt; 
                margin-top: 25px; 
                margin-bottom: 8px;
            }
            p { 
                margin-bottom: 10px; 
            }
            ul {
                margin-right: 20px;
                list-style-type: disc;
                margin-bottom: 10px;
            }
            ol {
                margin-right: 20px;
                list-style-type: decimal;
                margin-bottom: 10px;
            }
            li {
                margin-bottom: 5px;
            }
            strong {
                font-weight: bold;
                color: #006A4E;
            }
            img {
                display: block;
                margin-left: auto;
                margin-right: auto;
                max-width: 90%;
                height: auto;
                border: 1px solid #ccc;
                box-shadow: 2px 2px 8px rgba(0,0,0,0.1);
            }
            .footer {
                text-align: center;
                margin-top: 50px;
                font-size: 10pt;
                color: #777;
                border-top: 1px solid #eee;
                padding-top: 10px;
            }
        </style>
    </head>
    <body>
        <h1>دليل المشرف لبرنامج إعداد حافظ</h1>
        <p style="text-align: center; color: #555; font-size: 12pt;">تاريخ الإصدار: ${date}</p>
        <div style="page-break-after: always;"></div> <!-- Page break after title page -->
  `;

  contentSections.forEach(section => {
    htmlContent += `<h2>${section.title}</h2>`;
    htmlContent += section.body;
  });

  htmlContent += `
        <div class="footer">
            <p>تم إعداد هذا الدليل لمساعدتك في إدارة برنامج إعداد حافظ.</p>
            <p>&copy; ${new Date().getFullYear()} إعداد حافظ. جميع الحقوق محفوظة.</p>
        </div>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};