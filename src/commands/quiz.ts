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
interface UserState {
    streak: number;
    level: string;
    hasReachedN4: boolean; // Đánh dấu nếu đã từng leo tới N4
}
const userDatabase = new Map<string, UserState>();

export const command = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Chơi sinh tồn với ngữ pháp Anki! Sai 1 câu quay về vạch xuất phát.')
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
            userDatabase.set(userId, { streak: 0, level: 'N5', hasReachedN4: false });
        }
        const userState = userDatabase.get(userId)!;
        const cheatStreak = interaction.options.getInteger('cheat_streak');

        // Logic xử lý khi có người cố tình nhập tham số cheat_streak
        if (cheatStreak !== null) {
            if (userId === OWNER_ID) {
                userState.streak = cheatStreak;
                if (cheatStreak >= 20) {
                    userState.level = 'N4';
                    userState.hasReachedN4 = true;
                } else if (cheatStreak < 20 && !userState.hasReachedN4) {
                    userState.level = 'N5';
                }

                await interaction.followUp({ 
                    content: `👑 **[???]** Administrator vừa búng tay và tiến thẳng tới mốc **Streak ${cheatStreak}**!`, 
                    ephemeral: false 
                });
            } else {
                await interaction.followUp({ 
                    content: '🚫 Cảnh báo! Bạn không có quyền sử dụng tham số này. Bot sẽ bỏ qua và bắt đầu round bình thường của bạn.', 
                    ephemeral: true 
                });
            }
        }
        await playRound(interaction, userId, true);
    }
};

async function playRound(
    interaction: ChatInputCommandInteraction | MessageComponentInteraction, 
    userId: string, 
    isFirstRound: boolean
) {
    const userState = userDatabase.get(userId)!;
    const streak = userState.streak;

    let streakInstructions = "";
    
    if (streak < 3) {
        streakInstructions = "[MỨC DỄ]: BẮT BUỘC viết kèm nghĩa tiếng Việt của toàn bộ câu hỏi trong ngoặc đơn. Câu hỏi ngắn (1 mệnh đề). Các đáp án bẫy (distractors) phải khác biệt rõ ràng để học viên dễ chọn.";
    } else if (streak >= 3 && streak < 5) {
        streakInstructions = "[MỨC TRUNG BÌNH]: TUYỆT ĐỐI KHÔNG dịch tiếng Việt kế bên câu hỏi. Câu hỏi ngắn. Tập trung kiểm tra đúng 1 điểm ngữ pháp cơ bản.";
    } else if (streak >= 5 && streak < 15) {
        streakInstructions = "[MỨC KHÓ]: TUYỆT ĐỐI KHÔNG dịch tiếng Việt. Câu hỏi phải dài hơn (2 mệnh đề). Các đáp án bẫy phải cực kỳ tinh vi, ví dụ: bẫy cùng một động từ nhưng chia khác thể (VD: 食べる / 食べて / 食べられる), hoặc bẫy các trợ từ hay nhầm lẫn (に / で / を).";
    } else if (streak >= 15) {
        streakInstructions = "[MỨC ĐỊA NGỤC]: TUYỆT ĐỐI KHÔNG dịch tiếng Việt. Câu hỏi dài và đánh lừa nhiều lớp. Đáp án phải bẫy học viên dựa trên 'sắc thái' hoặc 'ngữ cảnh' giao tiếp (Ví dụ: sự khác biệt tinh tế giữa ている và てある). Cả 4 đáp án nhìn qua đều có vẻ đúng, yêu cầu phải hiểu sâu mới làm được.";
    }

    // Xử lý Level Up
    if (streak >= 20 && userState.level === 'N5') {
        userState.level = 'N4';
        userState.hasReachedN4 = true;
    }

    try {
        const vocabList = await getGachaVocab();
        if (vocabList.length === 0) {
            const errorMsg = "Không tìm thấy thẻ từ vựng Anki!";
            if (isFirstRound) await (interaction as ChatInputCommandInteraction).editReply(errorMsg);
            else await (interaction as MessageComponentInteraction).followUp(errorMsg);
            return;
        }

        const quiz = await generateGrammarQuiz(vocabList, userState.level, streakInstructions);
        const optionsArray = [
            { key: 'A', text: quiz.options.A },
            { key: 'B', text: quiz.options.B },
            { key: 'C', text: quiz.options.C },
            { key: 'D', text: quiz.options.D }
        ];

        const correctText = (quiz.options as any)[quiz.correctAnswer];
        // Thuật toán xáo trộn Fisher-Yates
        for (let i = optionsArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = optionsArray[i] as { key: string; text: string };
            optionsArray[i] = optionsArray[j] as { key: string; text: string };
            optionsArray[j] = temp;
        }

        quiz.options.A = optionsArray[0]!.text;
        quiz.options.B = optionsArray[1]!.text;
        quiz.options.C = optionsArray[2]!.text;
        quiz.options.D = optionsArray[3]!.text;

        if (quiz.options.A === correctText) quiz.correctAnswer = 'A';
        else if (quiz.options.B === correctText) quiz.correctAnswer = 'B';
        else if (quiz.options.C === correctText) quiz.correctAnswer = 'C';
        else if (quiz.options.D === correctText) quiz.correctAnswer = 'D';

        const isHideRecipe = streak >= 7;
        const isHideExplanation = streak >= 10;

        let descriptionStr = '';
        if (!isHideExplanation) descriptionStr += `*${quiz.explanation}*\n\n`;
        if (!isHideRecipe) descriptionStr += `**Công thức:**\n\`${quiz.recipe}\`\n\n`;
        descriptionStr += `**Câu hỏi:**\n ${quiz.question}`;

        const embedTitle = isHideExplanation 
            ? `🎯 Ngữ pháp: [Bị ẩn do Streak ${streak}+]` 
            : `🎯 Ngữ pháp: ${quiz.grammarPoint}`;

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(embedTitle)
            .setDescription(descriptionStr)
            .addFields(
                { name: 'A', value: quiz.options.A, inline: true },
                { name: 'B', value: quiz.options.B, inline: true },
                { name: 'C', value: quiz.options.C, inline: true },
                { name: 'D', value: quiz.options.D, inline: true },
            )
            .setFooter({ text: `🔥 Streak: ${streak} | Lvl: ${userState.level} | 🤖 ${quiz.modelUsed}` });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('A').setLabel('A').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('B').setLabel('B').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('C').setLabel('C').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('D').setLabel('D').setStyle(ButtonStyle.Primary),
        );

        let message;
        if (isFirstRound) {
            message = await (interaction as ChatInputCommandInteraction).editReply({ embeds: [embed], components: [row] });
        } else {
            message = await (interaction as MessageComponentInteraction).followUp({ embeds: [embed], components: [row], fetchReply: true });
        }

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300_000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                await i.reply({ content: 'Chỉ người gọi lệnh mới được chơi!', ephemeral: true });
                return;
            }

            const isCorrect = i.customId === quiz.correctAnswer;
            row.components.forEach(btn => btn.setDisabled(true));
            const resultEmbed = new EmbedBuilder()
                .setColor(isCorrect ? '#57F287' : '#ED4245')
                .setTitle(isCorrect ? '✅ Chính xác!' : `❌ Sai rồi! Đáp án là ${quiz.correctAnswer}`)
                .setDescription(`**Giải thích:**\n${quiz.reason}\n\n*Công thức gốc:* \`${quiz.recipe}\``);

            await i.update({ embeds: [embed, resultEmbed], components: [row] });
            collector.stop();
            if (isCorrect) {
                userState.streak++;
                await playRound(i, userId, false);
            } else {
                const oldStreak = userState.streak;
                userState.streak = 0;
                if (userState.hasReachedN4) {
                    userState.level = 'N5 xen kẽ N4';
                }
                await i.followUp({ 
                    content: `😏 Lệch nhịp! Bạn đã đứt chuỗi **${oldStreak} streak**. Trạng thái đã được reset về 0. Hãy gõ \`/quiz\` để bắt đầu lại!`, 
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