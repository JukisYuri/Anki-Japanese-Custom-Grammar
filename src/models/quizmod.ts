import mongoose, { Schema, Document } from 'mongoose';

export interface IQuiz extends Document {
    language: 'jp' | 'en';
    level: string;
    grammarPoint: string;
    explanation: string;
    recipe: string;
    example: string;
    vietnamese?: string;
    question: string;
    options: {
        A: string; B: string; C: string; D: string; E?: string; F?: string;
    };
    correctAnswer: string;
    reason: string;
    modelUsed: string;
}

const QuizSchema = new Schema({
    language: { type: String, required: true, enum: ['jp', 'en'] },
    level: { type: String, required: true },
    grammarPoint: String,
    explanation: String,
    recipe: String,
    example: String,
    vietnamese: String,
    question: String,
    options: {
        A: String, B: String, C: String, D: String, E: String, F: String
    },
    correctAnswer: String,
    reason: String,
    modelUsed: String
}, { timestamps: true });

export const Quiz = mongoose.model<IQuiz>('Quiz', QuizSchema);