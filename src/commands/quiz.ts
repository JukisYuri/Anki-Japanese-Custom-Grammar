import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType,
    ChatInputCommandInteraction,
    MessageComponentInteraction
} from 'discord.js';
import { getGachaVocab } from '../services/anki.js';
import { generateGrammarQuiz } from '../services/gemini.js';

// Cấu trúc lưu trữ trạng thái người chơi
interface LanguageProfile {
    streak: number;
    maxStreak: number;
    level: string;
}
interface UserState {
    jp: LanguageProfile;
    en: LanguageProfile;
}

const userDatabase = new Map<string, UserState>();

export const command = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Chơi sinh tồn với ngữ pháp! Sai 1 câu quay về vạch xuất phát.')
        .addStringOption(option =>
            option.setName('language')
                .setDescription('Chọn ngôn ngữ muốn bị game chơi')
                .setRequired(true)
                .addChoices(
                    { name: '🇯🇵 Tiếng Nhật (JLPT)', value: 'jp' },
                    { name: '🇬🇧 Tiếng Anh (CEFR)', value: 'en' }
                )
        )
        .addIntegerOption(option => 
            option.setName('cheat_streak')
                .setDescription('Chỉ định mốc Streak muốn nhảy đến (Đặc quyền Owner)')
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        const userId = interaction.user.id;
        const OWNER_ID = '607183227911667746'; // Owner ID

        // Khởi tạo trạng thái cho người mới
        if (!userDatabase.has(userId)) {
            userDatabase.set(userId, { 
                jp: { streak: 0, maxStreak: 0, level: 'N5' },
                en: { streak: 0, maxStreak: 0, level: 'A1/A2' }
            });
        }

        const userState = userDatabase.get(userId)!;
        // Lấy ngôn ngữ trước tiên để xác định đúng Profile
        const lang = interaction.options.getString('language') as 'jp' | 'en';
        const profile = userState[lang]; 
        
        const cheatStreak = interaction.options.getInteger('cheat_streak');

        // Logic cheat cập nhật thẳng vào Profile của ngôn ngữ đó
        if (cheatStreak !== null) {
            if (userId === OWNER_ID) {
                profile.streak = cheatStreak;
                if (cheatStreak > profile.maxStreak) {
                    profile.maxStreak = cheatStreak;
                }
                await interaction.followUp({ 
                    content: `👑 **[???]** Administrator vừa búng tay và tiến thẳng tới mốc **Streak ${cheatStreak}** hệ ${lang.toUpperCase()}!`, 
                    ephemeral: false 
                });
            } else {
                await interaction.followUp({ 
                    content: '🚫 Cảnh báo! Bạn không có quyền sử dụng tham số này. Bot sẽ bỏ qua và bắt đầu round bình thường của bạn.', 
                    ephemeral: true 
                });
            }
        }
        await playRound(interaction, userId, true, lang);
    }
};

async function playRound(
    interaction: ChatInputCommandInteraction | MessageComponentInteraction, 
    userId: string, 
    isFirstRound: boolean,
    lang: 'jp' | 'en'
) {
    const userState = userDatabase.get(userId)!;
    const profile = userState[lang];
    const streak = profile.streak;

    let streakInstructions = "";
    
    // CẤU HÌNH ĐỘ KHÓ SONG NGỮ
    if (lang === 'jp') {
        if (streak < 3) {
            streakInstructions = "[MỨC DỄ]: BẮT BUỘC viết kèm nghĩa tiếng Việt của toàn bộ câu hỏi. Có 4 đáp án.";
        } else if (streak >= 3 && streak < 5) {
            streakInstructions = "[MỨC TRUNG BÌNH]: TUYỆT ĐỐI KHÔNG dịch tiếng Việt. Câu hỏi ngắn. Có 4 đáp án.";
        } else if (streak >= 5 && streak < 15) {
            streakInstructions = "[MỨC KHÓ]: Câu hỏi 2 mệnh đề. Bẫy cùng động từ chia khác thể hoặc bẫy trợ từ. Có 4 đáp án.";
        } else if (streak >= 15 && streak < 25) {
            streakInstructions = "[MỨC ĐỊA NGỤC]: Câu hỏi dài nhiều lớp. Bẫy dựa trên sắc thái giao tiếp tinh tế. Có 4 đáp án.";
        } else if (streak >= 25 && streak < 30) {
            streakInstructions = "[MỨC ĐỤC LỖ KÉP]: Câu hỏi có 2 chỗ trống [___] và [___]. Các đáp án là tổ hợp 2 từ tương ứng (Ví dụ: に — 食べる). Có 4 đáp án.";
        } else if (streak >= 30 && streak < 40) {
            streakInstructions = "[MỨC HỘI THOẠI]: Trích đoạn hội thoại ngắn giữa A và B. Chỗ trống ở câu B. Tập trung bẫy vai vế (Tôn kính ngữ/Khiêm nhường ngữ). Có 4 đáp án.";
        } else if (streak >= 40 && streak < 45) {
            streakInstructions = "[MỨC TÌM CÂU ĐÚNG]: KHÔNG CÓ CÂU HỎI. Tạo 4 câu tiếng Nhật dài độc lập làm 4 đáp án. 3 câu sai ngữ pháp vi tế, CHỈ 1 CÂU ĐÚNG HOÀN TOÀN.";
        } else if (streak >= 45 && streak < 50) {
            streakInstructions = "[MỨC TÌM CÂU SAI]: KHÔNG CÓ CÂU HỎI. Tạo 4 câu tiếng Nhật dài độc lập làm 4 đáp án. 3 câu đúng hoàn toàn, CHỈ 1 CÂU SAI NGỮ PHÁP VI TẾ.";
        } else if (streak >= 50 && streak < 55) {
            streakInstructions = "[MỨC ĐỌC HIỂU 5 ĐÁP ÁN]: Đưa ra một bài đọc ngắn (3 câu). Đặt 1 câu hỏi trắc nghiệm nội dung. BẮT BUỘC trả về 5 đáp án (A, B, C, D, E).";
        } else if (streak >= 55) {
            streakInstructions = "[MỨC ĐỌC HIỂU 6 ĐÁP ÁN]: Đưa ra bài đọc dài. Đặt 1 câu hỏi suy luận. BẮT BUỘC trả về 6 đáp án (A, B, C, D, E, F). Bẫy bám sát nội dung dễ nhầm lẫn.";
        }
    } else {
        const enPrefix = "[CHẾ ĐỘ TIẾNG ANH CEFR ĐA DỤNG]: BỎ QUA Anki. TỰ TẠO ngữ cảnh đời sống/học thuật. ĐIỀU KIỆN SỐNG CÒN: MỖI LẦN PHẢI CHỌN NGẪU NHIÊN MỘT ĐIỂM NGỮ PHÁP/TỪ VỰNG HOÀN TOÀN KHÁC NHAU\n";
        
        if (streak < 3) {
            streakInstructions = enPrefix + "[MỨC DỄ CEFR A1/A2]: BẮT BUỘC dịch tiếng Việt kèm theo. Chọn NGẪU NHIÊN 1 chủ đề: Giới từ cơ bản, đại từ chỉ định, hoặc chia thì hiện tại đơn/tiếp diễn. Có 4 đáp án.";
        } else if (streak >= 3 && streak < 5) {
            streakInstructions = enPrefix + "[MỨC TRUNG BÌNH CEFR A2]: TUYỆT ĐỐI KHÔNG dịch. Chọn NGẪU NHIÊN 1 chủ đề: Động từ khiếm khuyết (Modal verbs), câu so sánh, hoặc từ nối cơ bản. Có 4 đáp án.";
        } else if (streak >= 5 && streak < 15) {
            streakInstructions = enPrefix + "[MỨC KHÓ CEFR B1]: Chọn NGẪU NHIÊN 1 chủ đề để gài bẫy: Phrasal Verbs đa dạng, câu điều kiện loại 1/loại 2, hoặc phân biệt các thì quá khứ. Các bẫy phải dễ nhầm lẫn. Có 4 đáp án.";
        } else if (streak >= 15 && streak < 25) {
            streakInstructions = enPrefix + "[MỨC ĐỊA NGỤC CEFR B2+]: Bẫy sắc thái nâng cao. Chọn NGẪU NHIÊN 1 chủ đề: Câu điều kiện loại 3/Hỗn hợp, cấu trúc Đảo ngữ (Inversion), Mệnh đề quan hệ rút gọn, hoặc Word Form phức tạp. Có 4 đáp án.";
        } else if (streak >= 25 && streak < 30) {
            streakInstructions = enPrefix + "[MỨC ĐỤC LỖ KÉP]: Câu hỏi có 2 chỗ trống ﹏﹏ và ﹏﹏ trong một đoạn văn ngắn hoặc email. Kiểm tra NGẪU NHIÊN sự phối hợp thì hoặc cụm từ cố định (Collocations). Đáp án là tổ hợp 2 từ. Có 4 đáp án.";
        } else if (streak >= 30 && streak < 40) {
            streakInstructions = enPrefix + "[MỨC GIAO TIẾP THỰC TẾ]: Trích đoạn hội thoại hàng ngày, tin nhắn hoặc phỏng vấn. Yêu cầu chọn câu trả lời tự nhiên nhất (Idioms/Slang phù hợp) hoặc từ vựng ngữ cảnh chính xác nhất cho chỗ trống. Có 4 đáp án.";
        } else if (streak >= 40 && streak < 45) {
            streakInstructions = enPrefix + "[MỨC TÌM CÂU ĐÚNG C1]: KHÔNG CÓ CÂU HỎI. Tạo 4 câu tiếng Anh phức tạp (chủ đề khoa học, xã hội, lịch sử). 3 câu CỐ TÌNH SAI ngữ pháp vi tế NGẪU NHIÊN (VD: sai sự hòa hợp chủ-vị, sai mạo từ, sai giới từ), CHỈ 1 CÂU ĐÚNG HOÀN TOÀN.";
        } else if (streak >= 45 && streak < 50) {
            streakInstructions = enPrefix + "[MỨC TÌM CÂU SAI C1]: Tạo 4 câu tiếng Anh học thuật/phức tạp. 3 câu chuẩn xác, CHỈ 1 CÂU SAI NGỮ PHÁP VI TẾ NGẪU NHIÊN.";
        } else if (streak >= 50 && streak < 55) {
            streakInstructions = enPrefix + "[MỨC ĐỌC HIỂU BÁO CHÍ]: Đưa ra một đoạn văn ngắn (báo chí, blog, bài luận). Đặt 1 câu trắc nghiệm nội dung đánh lừa suy luận. BẮT BUỘC trả về 5 đáp án (A, B, C, D, E).";
        } else if (streak >= 55) {
            streakInstructions = enPrefix + "[MỨC ĐỌC HIỂU IELTS/TOEFL]: Đưa ra một bài đọc tiếng Anh dài ở mức độ C1/C2. Đặt 1 câu hỏi suy luận sâu về nội dung hoặc thái độ tác giả. BẮT BUỘC trả về 6 đáp án (A, B, C, D, E, F).";
        }
    }

    if (lang === 'jp') {
        if (streak >= 60) {
            profile.level = 'N3';
        } else if (streak >= 20) {
            profile.level = profile.maxStreak >= 60 ? 'N4 xen kẽ N3' : 'N4';
        } else {
            if (profile.maxStreak >= 60) profile.level = 'N4 xen kẽ N3';
            else if (profile.maxStreak >= 20) profile.level = 'N5 xen kẽ N4';
            else profile.level = 'N5';
        }
    } else {
        if (streak >= 60) {
            profile.level = 'B2';
        } else if (streak >= 20) {
            profile.level = profile.maxStreak >= 60 ? 'B1 xen kẽ B2' : 'B1';
        } else {
            if (profile.maxStreak >= 60) profile.level = 'B1 xen kẽ B2';
            else if (profile.maxStreak >= 20) profile.level = 'A2 xen kẽ B1';
            else profile.level = 'A1/A2';
        }
    }

    try {
        const vocabList = await getGachaVocab();
        if (vocabList.length === 0) throw new Error("Không tìm thấy thẻ từ vựng Anki!");

        const quiz = await generateGrammarQuiz(vocabList, profile.level, streakInstructions, lang);
        
        const rawOptionsArray = [
            { key: 'A', text: quiz.options.A },
            { key: 'B', text: quiz.options.B },
            { key: 'C', text: quiz.options.C },
            { key: 'D', text: quiz.options.D }
        ];
        if (quiz.options.E) rawOptionsArray.push({ key: 'E', text: quiz.options.E });
        if (quiz.options.F) rawOptionsArray.push({ key: 'F', text: quiz.options.F });
        const correctText = (quiz.options as any)[quiz.correctAnswer];

        // Thuật toán xáo trộn Fisher-Yates
        for (let i = rawOptionsArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rawOptionsArray[i], rawOptionsArray[j]] = [rawOptionsArray[j]!, rawOptionsArray[i]!];
        }

        const currentKeys = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, rawOptionsArray.length);
        quiz.options = {} as any;
        rawOptionsArray.forEach((opt, index) => {
            const newKey = currentKeys[index]!;
            (quiz.options as any)[newKey] = opt.text;
            if (opt.text === correctText) quiz.correctAnswer = newKey as any;
        });
        
        const isHideVietnamese = streak >= 3;
        const isHideRecipe = streak >= 5;
        const isHideExplanation = streak >= 7;

        let descriptionStr = '';
        if (!isHideExplanation && quiz.explanation) descriptionStr += `*${quiz.explanation}*\n\n`;
        if (!isHideRecipe && quiz.recipe) descriptionStr += `**Công thức:**\n\`${quiz.recipe}\`\n\n`;
        if (!isHideVietnamese && quiz.vietnamese) descriptionStr += `**Nghĩa tiếng Việt:**\n ${quiz.vietnamese}\n\n`;
        if (quiz.question) descriptionStr += `**Câu hỏi:**\n ${quiz.question}`;

        const embedFields = currentKeys.map(key => ({
            name: key,
            value: (quiz.options as any)[key],
            inline: true
        }));

        const embedTitle = isHideExplanation 
            ? `🎯 Ngữ pháp: [Bị ẩn do Streak ${streak}+]` 
            : `🎯 Ngữ pháp: ${quiz.grammarPoint}`;

        const langIcon = lang === 'jp' ? '🇯🇵' : '🇬🇧';
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(embedTitle)
            .setDescription(descriptionStr)
            .addFields(embedFields)
            .setFooter({ text: `${langIcon} Streak: ${streak} | Lvl: ${profile.level} | 🤖 ${quiz.modelUsed}` });

        const row1 = new ActionRowBuilder<ButtonBuilder>();
        const row2 = new ActionRowBuilder<ButtonBuilder>();

        currentKeys.forEach((key, index) => {
            const btn = new ButtonBuilder().setCustomId(key).setLabel(key).setStyle(ButtonStyle.Primary);
            if (index < 5) row1.addComponents(btn);
            else row2.addComponents(btn);
        });

        const components: any[] = [row1];
        if (currentKeys.length > 5) components.push(row2);

        let message;
        if (isFirstRound) {
            message = await (interaction as ChatInputCommandInteraction).editReply({ embeds: [embed], components });
        } else {
            message = await (interaction as MessageComponentInteraction).followUp({ embeds: [embed], components, fetchReply: true });
        }

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300_000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                await i.reply({ content: 'Chỉ người gọi lệnh mới được chơi!', ephemeral: true });
                return;
            }

            const isCorrect = i.customId === quiz.correctAnswer;
            components.forEach(row => row.components.forEach((btn: any) => btn.setDisabled(true)));
            const resultEmbed = new EmbedBuilder()
                .setColor(isCorrect ? '#57F287' : '#ED4245')
                .setTitle(isCorrect ? '✅ Chính xác!' : `❌ Sai rồi! Đáp án là ${quiz.correctAnswer}`)
                .setDescription(`**Giải thích:**\n${quiz.reason}\n\n*Công thức gốc:* \`${quiz.recipe || 'Không có'}\``);

            await i.update({ embeds: [embed, resultEmbed], components });
            collector.stop();
            
            if (isCorrect) {
                profile.streak++;
                if (profile.streak > profile.maxStreak) {
                    profile.maxStreak = profile.streak; 
                }
                await playRound(i, userId, false, lang);
            } else {
                const oldStreak = profile.streak;
                profile.streak = 0;
                
                await i.followUp({ 
                    content: `😏 Lệch nhịp! Bạn đã đứt chuỗi **${oldStreak} streak** hệ ${lang.toUpperCase()}. Hãy gõ \`/quiz\` để bắt đầu lại!`, 
                    ephemeral: false 
                });
            }
        });

    } catch (error) {
        console.error(error);
        const errorMsg = "Hệ thống tạo câu hỏi đang gặp trục trặc.";
        if (isFirstRound) await (interaction as ChatInputCommandInteraction).editReply(errorMsg);
        else await (interaction as MessageComponentInteraction).followUp(errorMsg);
    }
}