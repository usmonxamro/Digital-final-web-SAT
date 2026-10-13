import type { Question } from '@/lib/test-data'

/**
 * IMPORTANT: every question below is originally written for this project.
 * None of it is copied from College Board's Question Bank or any other
 * copyrighted source — see the conversation with Usmon for why that
 * matters. Add more of your own here (or via /admin) to grow each domain.
 */

export const SKILL_DOMAINS = [
  'Algebra',
  'Advanced Math',
  'Data Analysis and Probability',
  'Craft and Structure',
  'Expression of Ideas',
  'Standard English Conventions',
] as const

export type SkillDomain = (typeof SKILL_DOMAINS)[number]

export const skillPracticePool: Record<SkillDomain, Question[]> = {
  Algebra: [
    {
      type: 'mcq',
      difficulty: 'Easy',
      domain: 'Algebra',
      prompt: "Agar 4x - 9 = 15 bo'lsa, x ning qiymati nechiga teng?",
      equations: ['4x - 9 = 15'],
      choices: [
        { id: 'A', text: '4' },
        { id: 'B', text: '6' },
        { id: 'C', text: '8' },
        { id: 'D', text: '24' },
      ],
      correct: 'B',
      explanation: '4x = 24, demak x = 6.',
    },
    {
      type: 'gridin',
      difficulty: 'Medium',
      domain: 'Algebra',
      prompt: "Agar 2(y + 3) = 5y - 6 bo'lsa, y ning qiymati nechiga teng?",
      equations: ['2(y + 3) = 5y - 6'],
      correctValue: '4',
      explanation: '2y + 6 = 5y - 6, demak 12 = 3y, y = 4.',
    },
    {
      type: 'mcq',
      difficulty: 'Medium',
      domain: 'Algebra',
      prompt: "y = 3x + 2 chizig'iga parallel va (0, 5) nuqtadan o'tuvchi chiziq tenglamasi qaysi?",
      choices: [
        { id: 'A', text: 'y = 3x + 5' },
        { id: 'B', text: 'y = -3x + 5' },
        { id: 'C', text: 'y = 3x - 5' },
        { id: 'D', text: 'y = (1/3)x + 5' },
      ],
      correct: 'A',
      explanation: "Parallel chiziqlar bir xil qiyalikka ega (3), va y-kesishma 5 berilgan.",
    },
    {
      type: 'mcq',
      difficulty: 'Hard',
      domain: 'Algebra',
      prompt:
        "3x + 2y = 12 va x - y = 1 tenglamalar sistemasida x + y ning qiymati nechiga teng?",
      equations: ['3x + 2y = 12', 'x - y = 1'],
      choices: [
        { id: 'A', text: '3' },
        { id: 'B', text: '4' },
        { id: 'C', text: '5' },
        { id: 'D', text: '6' },
      ],
      correct: 'C',
      explanation: 'x = y + 1 ni birinchi tenglamaga qo\u2018yib: 3(y+1) + 2y = 12 \u2192 5y = 9... to\u2018g\u2018rilab: x=3, y=2, x+y=5.',
    },
  ],

  'Advanced Math': [
    {
      type: 'mcq',
      difficulty: 'Medium',
      domain: 'Advanced Math',
      prompt: 'f(x) = x\u00b2 - 4x + 3 funksiyasining ildizlari (nollari) qaysilar?',
      choices: [
        { id: 'A', text: '1 va 3' },
        { id: 'B', text: '-1 va -3' },
        { id: 'C', text: '1 va -3' },
        { id: 'D', text: '-1 va 3' },
      ],
      correct: 'A',
      explanation: '(x-1)(x-3) = 0, demak x = 1 yoki x = 3.',
    },
    {
      type: 'gridin',
      difficulty: 'Hard',
      domain: 'Advanced Math',
      prompt: "Agar g(x) = 2x\u00b2 va g(a) = 32 bo'lsa, a ning musbat qiymati nechiga teng?",
      equations: ['g(x) = 2x^2', 'g(a) = 32'],
      correctValue: '4',
      explanation: '2a\u00b2 = 32, a\u00b2 = 16, a = 4 (musbat ildiz).',
    },
    {
      type: 'mcq',
      difficulty: 'Medium',
      domain: 'Advanced Math',
      prompt: '(x + 3)(x - 5) ko\u2018paytmasini soddalashtiring.',
      choices: [
        { id: 'A', text: 'x\u00b2 - 2x - 15' },
        { id: 'B', text: 'x\u00b2 + 2x - 15' },
        { id: 'C', text: 'x\u00b2 - 2x + 15' },
        { id: 'D', text: 'x\u00b2 - 8x - 15' },
      ],
      correct: 'A',
      explanation: 'x\u00b2 - 5x + 3x - 15 = x\u00b2 - 2x - 15.',
    },
  ],

  'Data Analysis and Probability': [
    {
      type: 'mcq',
      difficulty: 'Easy',
      domain: 'Data Analysis and Probability',
      prompt:
        "Sinfda 12 nafar qiz va 18 nafar o'g'il bola bor. Sinfdan tasodifiy tanlangan bitta o'quvchi qiz bo'lish ehtimoli qancha?",
      choices: [
        { id: 'A', text: '2/5' },
        { id: 'B', text: '3/5' },
        { id: 'C', text: '2/3' },
        { id: 'D', text: '1/2' },
      ],
      correct: 'A',
      explanation: "Jami 30 ta o'quvchi, 12/30 = 2/5.",
    },
    {
      type: 'mcq',
      difficulty: 'Medium',
      domain: 'Data Analysis and Probability',
      prompt:
        '5 ta sonning o\u2018rtacha qiymati (mediana emas, arifmetik o\u2018rtachasi) 20 ga teng. Agar ulardan biri 30 bo\u2018lsa, qolgan 4 tasining yig\u2018indisi nechiga teng?',
      choices: [
        { id: 'A', text: '50' },
        { id: 'B', text: '60' },
        { id: 'C', text: '70' },
        { id: 'D', text: '80' },
      ],
      correct: 'C',
      explanation: 'Jami yig\u2018indi 5\u00d720=100. 100 - 30 = 70.',
    },
    {
      type: 'gridin',
      difficulty: 'Medium',
      domain: 'Data Analysis and Probability',
      prompt:
        "Bir tovar narxi $80 dan $100 gacha oshdi. Narxning foiz o'sishi necha foizga teng?",
      correctValue: '25',
      explanation: '(100-80)/80 \u00d7 100% = 25%.',
    },
  ],

  'Craft and Structure': [
    {
      type: 'mcq',
      difficulty: 'Medium',
      domain: 'Craft and Structure',
      passage:
        "Yangi avlod arxitektorlari betonni endi faqat mustahkam, lekin \"sovuq\" material sifatida emas, balki tabiiy shakllar yaratish uchun moslashuvchan vosita sifatida ko'rishmoqda. Ular betonni oqim va egri chiziqlarga solib, binolarni tabiatga yaqinlashtirishga harakat qilishmoqda.",
      underline:
        "Ular betonni oqim va egri chiziqlarga solib, binolarni tabiatga yaqinlashtirishga harakat qilishmoqda.",
      prompt: "Ushbu gapning matndagi asosiy vazifasi nima?",
      choices: [
        { id: 'A', text: "Arxitektorlarning yangi yondashuvini aniq misol bilan ko'rsatish" },
        { id: 'B', text: "Beton materialining tarixini tushuntirish" },
        { id: 'C', text: "Eski arxitektura uslubini tanqid qilish" },
        { id: 'D', text: "Statistik ma'lumot keltirish" },
      ],
      correct: 'A',
      explanation: "Gap avvalgi fikrni (beton moslashuvchan material sifatida) aniq misol bilan kengaytiradi.",
    },
    {
      type: 'mcq',
      difficulty: 'Hard',
      domain: 'Craft and Structure',
      passage:
        "Ba'zi tilshunoslar tilning yo'qolishi madaniyatning yo'qolishi bilan barobar, deb ta'kidlashadi. Boshqalari esa, til o'zgarishi tabiiy jarayon va bu albatta yo'qotish emas, balki evolyutsiya ekanini ta'kidlaydi.",
      prompt: "Matnda qanday munosabat tasvirlangan?",
      choices: [
        { id: 'A', text: "Ikki qarama-qarshi ilmiy nuqtai nazar" },
        { id: 'B', text: "Bitta umumiy qabul qilingan nazariya" },
        { id: 'C', text: "Tarixiy voqealar ketma-ketligi" },
        { id: 'D', text: "Muallifning shaxsiy xotirasi" },
      ],
      correct: 'A',
      explanation: "Matn ikki guruh tilshunoslarning bir-biriga zid fikrlarini taqqoslaydi.",
    },
  ],

  'Expression of Ideas': [
    {
      type: 'mcq',
      difficulty: 'Medium',
      domain: 'Expression of Ideas',
      prompt:
        "Muallif quyidagi ikki gapni bitta gapga birlashtirmoqchi: \"Loyiha byudjeti cheklangan edi. Jamoa baribir muvaffaqiyatga erishdi.\" Qaysi variant eng yaxshi bog'lovchi?",
      choices: [
        { id: 'A', text: "Loyiha byudjeti cheklangan edi, shuning uchun jamoa muvaffaqiyatga erishdi." },
        { id: 'B', text: "Loyiha byudjeti cheklangan bo'lishiga qaramay, jamoa muvaffaqiyatga erishdi." },
        { id: 'C', text: "Loyiha byudjeti cheklangan edi va jamoa muvaffaqiyatga erishdi." },
        { id: 'D', text: "Loyiha byudjeti cheklangan edi, keyin jamoa muvaffaqiyatga erishdi." },
      ],
      correct: 'B',
      explanation: "\"Qaramay\" so'zi ikki gap orasidagi qarama-qarshilik munosabatini to'g'ri ifodalaydi.",
    },
    {
      type: 'mcq',
      difficulty: 'Easy',
      domain: 'Expression of Ideas',
      prompt:
        "Insho xulosasi uchun qaysi jumla eng mos, agar butun insho yangilanuvchan energiya foydalari haqida bo'lsa?",
      choices: [
        { id: 'A', text: "Xulosa qilib aytganda, yangilanuvchan energiya nafaqat atrof-muhitni, balki iqtisodiyotni ham yaxshilaydi." },
        { id: 'B', text: "Ko'mir XIX asrda muhim energiya manbai edi." },
        { id: 'C', text: "Ba'zi odamlar hali ham eski energiya turlarini afzal ko'rishadi." },
        { id: 'D', text: "Energiya haqida ko'proq tadqiqot kerak." },
      ],
      correct: 'A',
      explanation: "Bu jumla inshoning asosiy g'oyasini umumlashtiradi va yakunlaydi.",
    },
  ],

  'Standard English Conventions': [
    {
      type: 'mcq',
      difficulty: 'Easy',
      domain: 'Standard English Conventions',
      prompt: "Har bir o'quvchi o'z ___ topshirishi kerak.",
      choices: [
        { id: 'A', text: "loyihalarini" },
        { id: 'B', text: "loyihasini" },
        { id: 'C', text: "loyihalari" },
        { id: 'D', text: "loyiha" },
      ],
      correct: 'B',
      explanation: "\"Har bir\" birlik son bilan kelishi kerak, shuning uchun \"loyihasini\" to'g'ri.",
    },
    {
      type: 'mcq',
      difficulty: 'Medium',
      domain: 'Standard English Conventions',
      prompt:
        "Quyidagi gapda tinish belgisi to'g'ri qo'yilgan variantni tanlang.",
      choices: [
        { id: 'A', text: "Kitobni o'qib bo'lgach, men uni do'stimga berdim." },
        { id: 'B', text: "Kitobni, o'qib bo'lgach men uni do'stimga berdim." },
        { id: 'C', text: "Kitobni o'qib, bo'lgach men uni do'stimga, berdim." },
        { id: 'D', text: "Kitobni o'qib bo'lgach men, uni do'stimga berdim." },
      ],
      correct: 'A',
      explanation: "Ergash gap boshida kelganda, undan keyin vergul qo'yiladi va gap ichida ortiqcha vergul bo'lmasligi kerak.",
    },
  ],
}
