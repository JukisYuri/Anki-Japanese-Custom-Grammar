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
        .setDescription('Chơi sinh tồn với ngữ pháp Anki! Sai 1 câu quay về vạch xuất phát.'),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        const userId = interaction.user.id;

        // Khởi tạo trạng thái cho người mới
        if (!userDatabase.has(userId)) {
            userDatabase.set(userId, { streak: 0, level: 'N5', hasReachedN4: false });
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
        streakInstructions = "BẮT BUỘC viết kèm nghĩa tiếng Việt của toàn bộ câu hỏi trong ngoặc đơn.";
    } else if (streak >= 3 && streak < 5) {
        streakInstructions = "TUYỆT ĐỐI KHÔNG dịch tiếng Việt kế bên câu hỏi.";
    } else if (streak >= 5 && streak < 15) {
        streakInstructions = "TUYỆT ĐỐI KHÔNG dịch tiếng Việt. Câu hỏi phải dài hơn, các đáp án gây nhiễu phải cực kỳ khó phân biệt.";
    } else if (streak >= 15) {
        streakInstructions = "TUYỆT ĐỐI KHÔNG dịch tiếng Việt. Câu hỏi phải ở mức độ cực kỳ khó, đánh lừa nhiều lớp, đáp án dài và phức tạp.";
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
                    content: `:😏 Lệch nhịp! Bạn đã đứt chuỗi **${oldStreak} streak**. Trạng thái đã được reset về 0. Hãy gõ \`/quiz\` để bắt đầu lại!`, 
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