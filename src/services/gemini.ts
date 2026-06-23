import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import type { VocabCard } from './anki.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const pickModel = [
    'gemini-3.5-flash', 
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite'
];

export interface QuizData {
    grammarPoint: string;
    explanation: string;
    question: string;
    recipe: string;
    example: string;
    options: {
        A: string;
        B: string;
        C: string;
        D: string;
    };
    correctAnswer: "A" | "B" | "C" | "D";
    reason: string;
    modelUsed: string;
}

export async function generateGrammarQuiz(
    vocabList: VocabCard[], 
    level: string, 
    streakInstructions: string
): Promise<QuizData> {
    const vocabString = vocabList.map(v => `${v.vocab} (${v.meaning})`).join(', ');
    const promptTemplate = fs.readFileSync(path.join(process.cwd(), './src/prompt.txt'), 'utf-8');
    
    const finalPrompt = promptTemplate
        .replace('[{{VOCAB_LIST}}]', vocabString)
        .replace('[{{LEVEL_CONTEXT}}]', level)
        .replace('[{{STREAK_INSTRUCTIONS}}]', streakInstructions);
    
    for (const modelName of pickModel) {
        console.log(`\n🤖 Đang thử model: ${modelName}...`);
        
        try {
            const currentModel = genAI.getGenerativeModel({ 
                model: modelName, 
                generationConfig: { responseMimeType: "application/json" } 
            });
            const result = await currentModel.generateContent(finalPrompt);
            const responseText = result.response.text();
            
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Không trả về định dạng JSON chuẩn.");  
            
            const quizData = JSON.parse(jsonMatch[0]) as QuizData;
            quizData.modelUsed = modelName; 
            return quizData;
            
        } catch (error: any) {
            console.warn(`[Cảnh báo] Model ${modelName} thất bại: ${error.message}. Chuyển model...`);
            continue; 
        }
    }
    
    throw new Error('[Sập toàn tập] Tất cả các model dự phòng đều đang quá tải!');
}