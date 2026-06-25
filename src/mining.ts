import { connectDB } from './services/database.js';
import { Quiz } from './models/quizmod.js';
import { generateGrammarQuiz } from './services/gemini.js';
import { getGachaVocab } from './services/anki.js';

// Cấu hình mining: Ngôn ngữ, mức độ CEFR/JLPT, số lượng câu hỏi cần tạo
const FARM_CONFIG = {
    lang: 'en' as 'jp' | 'en',
    level: 'B1',
    streakInstructions: "[CHẾ ĐỘ TIẾNG ANH CEFR ĐA DỤNG]: BỎ QUA Anki. TỰ TẠO ngữ cảnh đời sống/học thuật. ĐIỀU KIỆN SỐNG CÒN: MỖI LẦN PHẢI CHỌN NGẪU NHIÊN MỘT ĐIỂM NGỮ PHÁP/TỪ VỰNG HOÀN TOÀN KHÁC NHAU\n" +
    "Trích đoạn hội thoại hàng ngày, tin nhắn hoặc phỏng vấn. Yêu cầu chọn câu trả lời tự nhiên nhất (Idioms/Slang phù hợp) hoặc từ vựng ngữ cảnh chính xác nhất cho chỗ trống. Có 4 đáp án.",
    targetCount: 100 // đổi số lượng tuỳ ý
};

async function runFarm() {
    await connectDB();
    console.log(`\nMining Hệ: ${FARM_CONFIG.lang.toUpperCase()} | Lvl: ${FARM_CONFIG.level}`);
    
    let successCount = 0;

    for (let i = 1; i <= FARM_CONFIG.targetCount; i++) {
        console.log(`\n⏳ Mining ${i}/${FARM_CONFIG.targetCount}...`);
        try {
            let vocabList: any[] = [];
            // Nếu là tiếng Nhật thì vẫn phải bốc Anki
            if (FARM_CONFIG.lang === 'jp') {
                vocabList = await getGachaVocab();
            }

            // Gọi AI sinh câu hỏi
            const quizData = await generateGrammarQuiz(
                vocabList, 
                FARM_CONFIG.level, 
                FARM_CONFIG.streakInstructions, 
                FARM_CONFIG.lang
            );

            // Đúc vào khuôn DB và lưu lại
            const newQuiz = new Quiz({
                language: FARM_CONFIG.lang,
                level: FARM_CONFIG.level,
                grammarPoint: quizData.grammarPoint,
                explanation: quizData.explanation,
                recipe: quizData.recipe,
                example: quizData.example,
                vietnamese: quizData.vietnamese,
                question: quizData.question,
                options: quizData.options,
                correctAnswer: quizData.correctAnswer,
                reason: quizData.reason,
                modelUsed: quizData.modelUsed
            });

            await newQuiz.save();
            successCount++;
            console.log(`[Thành công] Đã cất vào kho 1 câu: ${quizData.grammarPoint}`);
            await new Promise(res => setTimeout(res, 2000)); 

        } catch (error: any) {
            console.error(`[Lỗi ở ${i}]: ${error.message}`);
        }
    }

    console.log(`\nHoàn thành, Năng suất: ${successCount}/${FARM_CONFIG.targetCount} câu.`);
    process.exit(0);
}

runFarm();