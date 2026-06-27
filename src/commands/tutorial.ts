import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('tutorial')
        .setDescription('Hướng dẫn luật chơi và cơ chế Sinh tồn Ngữ pháp'),

    async execute(interaction: ChatInputCommandInteraction) {
        const tutorialEmbed = new EmbedBuilder()
            .setColor('#d0b7ff')
            .setTitle('Những Luật Chơi Trên Quiz (/quiz)')
            .setDescription('Chào mừng bạn đến với quiz! Dưới đây là hướng dẫn cùng các quy tắc.')
            .addFields(
                {
                    name: '🩸 Nguyên Tắc Sinh Tồn Cơ Bản',
                    value: '• **Đột tử (Permadeath):** Trả lời đúng để đi tiếp (+1 Streak). Trả lời sai, toàn bộ chuỗi Streak lập tức reset về 0.\n• **Thời gian:** Bạn có tối đa **5 phút** để đưa ra quyết định cho mỗi câu hỏi.\n• **Bảo mật:** Chỉ người gọi lệnh mới có quyền bấm nút trả lời.'
                },
                {
                    name: '👁️ Quy Tắc "Tước Đoạt" (UI Deprivation)',
                    value: 'Trò chơi sẽ nuông chiều bạn lúc đầu, nhưng sẽ dần tước đoạt sự trợ giúp khi Streak tăng:\n• **Streak 0 - 2:** Đầy đủ Tên ngữ pháp, Giải thích, Công thức và Nghĩa tiếng Việt.\n• **Streak 3:** Ẩn hoàn toàn **Nghĩa tiếng Việt**.\n• **Streak 5:** Ẩn **Công thức** ngữ pháp.\n• **Streak 7:** Ẩn **Tên và Giải thích ngữ pháp**. Viền tin nhắn chuyển sang màu **đỏ** 🔴, chính thức bước vào game.'
                },
                {
                    name: '📈 Bảng Thăng Cấp & Độ Khó (Difficulty Scaling)',
                    value: 'Độ khó và số lượng đáp án thay đổi theo mốc Streak của bạn:\n\n**🇯🇵 Nhánh Tiếng Nhật (JLPT)**\n• **Streak 0 - 19:** N5 (4 đáp án)\n• **Streak 20 - 39:** N4 (4 đáp án)\n• **Streak 40 - 79:** N3 (4 đáp án)\n• **Streak 80+:** N2 (6 đáp án)\n\n**🇬🇧 Nhánh Tiếng Anh (CEFR)**\n• **Streak 0 - 19:** A1/A2 (4 đáp án)\n• **Streak 20 - 39:** B1 (4 đáp án)\n• **Streak 40 - 59:** B2 (4 đáp án, có tỉ lệ trộn lẫn 5 đáp án)\n• **Streak 60 - 79:** C1 (5 đáp án)\n• **Streak 80+:** C2 (6 đáp án)'
                },
                {
                    name: '🧠 Cơ Chế Trí Nhớ & Hình Phạt',
                    value: '• **Không lặp lại:** Hệ thống ghi nhớ ID các câu hỏi bạn đã làm đúng. Bạn sẽ **không bao giờ** gặp lại một câu 2 lần trong cùng một chuỗi Streak.\n• **Hình phạt:** Khi trả lời sai, toàn bộ trí nhớ của hệ thống về các câu bạn đã làm sẽ bị **xóa sạch**. Chúng sẽ bị đổ ngược lại vào kho chứa, buộc bạn phải chứng minh lại kiến thức từ con số 0.\n• **Phá đảo:** Nếu bạn đạt đến **streak 100**, hệ thống sẽ vinh danh bạn và tự động reset trí nhớ để bạn chơi lại vòng mới.'
                }
            )
            .setFooter({ text: 'Sự khoan nhượng không tồn tại ở đây. Chúc bạn may mắn! Bot Author: Jukis Yuri' });
        await interaction.reply({ embeds: [tutorialEmbed] });
    }
};