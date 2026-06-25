import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    discordId: string;
    jp: { streak: number; maxStreak: number; level: string; };
    en: { streak: number; maxStreak: number; level: string; };
}

const UserSchema = new Schema({
    discordId: { type: String, required: true, unique: true },
    jp: {
        streak: { type: Number, default: 0 },
        maxStreak: { type: Number, default: 0 },
        level: { type: String, default: 'N5' },
        playedQuizzes: [{ type: Schema.Types.ObjectId, ref: 'Quiz', default: [] }]
    },
    en: {
        streak: { type: Number, default: 0 },
        maxStreak: { type: Number, default: 0 },
        level: { type: String, default: 'A1/A2' },
        playedQuizzes: [{ type: Schema.Types.ObjectId, ref: 'Quiz', default: [] }]
    }
});

export const User = mongoose.model<IUser>('User', UserSchema);