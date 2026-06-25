import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

export async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'Không tồn tại MONGODB_URI trong file .env');
        console.log('Đã kết nối thành công MongoDB!');
    } catch (error) {
        console.error('Lỗi kết nối Database:', error);
        process.exit(1);
    }
}