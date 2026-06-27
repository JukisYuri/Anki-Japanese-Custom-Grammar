import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import type { VocabCard } from './anki.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "Không tồn tại GEMINI_API_KEY trong file .env");
const qwenClient = new OpenAI({
    apiKey: process.env.QWEN_API_KEY || "Không tồn tại QWEN_API_KEY trong file .env",
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
});

const pickModel = [
    // 'qwen3.6-flash',
    'qwen3.7-max',
    'qwen3.7-plus',
    'qwen3.6-plus',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'qwen-plus',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite'
];

export interface QuizData {
    grammarPoint: string;
    explanation: string;
    question: string;
    recipe: string;
    example: string;
    vietnamese: string;
    options: {
        A: string;
        B: string;
        C: string;
        D: string;
        E?: string;
        F?: string;
    };
    correctAnswer: "A" | "B" | "C" | "D" | "E" | "F";
    reason: string;
    modelUsed: string;
}

export async function generateGrammarQuiz(
    vocabList: VocabCard[], 
    level: string, 
    streakInstructions: string,
    lang: 'jp' | 'en'
): Promise<QuizData> {
    const vocabString = vocabList.length > 0 
        ? vocabList.map(v => `${v.vocab} (${v.meaning})`).join(', ') 
        : "Hãy tự do sử dụng từ vựng Tiếng Anh đa dạng thuộc nhiều chủ đề khác nhau trong đời sống, phù hợp với khung năng lực CEFR.";

    // CHỌN FILE PROMPT DỰA TRÊN NGÔN NGỮ
    const promptFileName = lang === 'jp' ? 'prompt_jp.txt' : 'prompt_en.txt';
    const promptTemplate = fs.readFileSync(path.join(process.cwd(), `./src/${promptFileName}`), 'utf-8');
    
    const finalPrompt = promptTemplate
        .replace('[{{VOCAB_LIST}}]', vocabString)
        .replace('[{{LEVEL_CONTEXT}}]', level)
        .replace('[{{STREAK_INSTRUCTIONS}}]', streakInstructions);

    // SYSTEM ROLE DỰA TRÊN NGÔN NGỮ
    const systemRole = lang === 'jp' 
        ? "You are a Japanese linguistics expert. You must strictly output your response in valid JSON format."
        : "You are an English linguistics expert specializing in CEFR. You must strictly output your response in valid JSON format.";

    for (const modelName of pickModel) {
        console.log(`\n🤖 Đang thử model: ${modelName} - Hệ: ${lang.toUpperCase()}...`);
        
        try {
            let responseText = "";

            if (modelName.startsWith('gemini')) {
                const currentModel = genAI.getGenerativeModel({ 
                    model: modelName, 
                    systemInstruction: systemRole,
                    generationConfig: { responseMimeType: "application/json" } 
                });
                const result = await currentModel.generateContent(finalPrompt);
                responseText = result.response.text();
            } 
            else if (modelName.startsWith('qwen')) {
                const completion = await qwenClient.chat.completions.create({
                    model: modelName,
                    messages: [
                        { role: "system", content: systemRole },
                        { role: "user", content: finalPrompt }
                    ],
                    response_format: { type: "json_object" }
                });
                responseText = completion.choices[0]?.message.content || "{}";
            }
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Không trả về định dạng JSON chuẩn.");  
            
            const quizData = JSON.parse(jsonMatch[0]) as QuizData;
            quizData.modelUsed = modelName; 
            return quizData;
            
        } catch (error: any) {
            console.warn(`[Cảnh báo] Model ${modelName} thất bại: ${error.message}. Chuyển qua model tiếp theo...`);
            continue; 
        }
    }
    
    throw new Error('[Sập toàn tập] Tất cả các LLM dự phòng đều đang chết hoặc quá tải API!');
}