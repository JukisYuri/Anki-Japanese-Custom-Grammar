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
import { User } from '../models/user.js';
import { Quiz } from '../models/quizmod.js';

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
        const OWNER_ID = '607183227911667746'; 

        // Lấy hoặc tạo hồ sơ người chơi từ database
        let userDoc = await User.findOne({ discordId: userId });
        if (!userDoc) {
            userDoc = new User({ discordId: userId });
            await userDoc.save();
        }

        const lang = interaction.options.getString('language') as 'jp' | 'en';
        const profile = userDoc[lang]; 
        
        const cheatStreak = interaction.options.getInteger('cheat_streak');

        if (cheatStreak !== null) {
            if (userId === OWNER_ID) {
                profile.streak = cheatStreak;
                if (cheatStreak > profile.maxStreak) {
                    profile.maxStreak = cheatStreak;
                }
                await userDoc.save(); // Lưu ngay xuống DB
                await interaction.followUp({ 
                    content: `👑 **[???]** Administrator vừa búng tay và tiến thẳng tới mốc **Streak ${cheatStreak}** hệ ${lang.toUpperCase()}!`, 
                    ephemeral: false 
                });
            } else {
                await interaction.followUp({ 
                    content: '🚫 Cảnh báo! Bạn không có quyền sử dụng tham số này.', 
                    ephemeral: true 
                });
            }
        }
        await playRound(interaction, userDoc, true, lang);
    }
};

async function playRound(
    interaction: ChatInputCommandInteraction | MessageComponentInteraction, 
    userDoc: any, 
    isFirstRound: boolean,
    lang: 'jp' | 'en'
) {
    const profile = userDoc[lang];
    const streak = profile.streak;    
    if (lang === 'jp') {
        if (streak >= 60) {
            profile.level = 'N3';
        } else if (streak >= 20) {
            profile.level = 'N4';
        } else {
            profile.level = 'N5';
        }
    } else {
        if (streak >= 40) {
            profile.level = 'B2';
        } else if (streak >= 20) {
            profile.level = 'B1';
        } else {
            profile.level = 'A1/A2';
        }
    }

    try {
        // Thêm màng lọc $nin để loại bỏ các câu đã chơi
        const randomQuizArray = await Quiz.aggregate([
            { 
                $match: { 
                    language: lang, 
                    level: profile.level,
                    _id: { $nin: profile.playedQuizzes }
                } 
            },
            { $sample: { size: 1 } }
        ]);

        // Xử lý kịch bản Hết đạn hoặc Phá đảo
        if (randomQuizArray.length === 0) {
            if (profile.playedQuizzes.length > 0) {
                // Đã cày hết sạch các câu ở Level này -> Rửa bộ nhớ
                profile.playedQuizzes = [];
                await userDoc.save();
                const resetMsg = `🎉 Chúc mừng! Bạn đã cày nát kho đạn hệ **${lang.toUpperCase()}** cấp **${profile.level}**. Trí nhớ đã được reset, hãy gõ \`/quiz\` để chơi lại vòng mới nhé!`;
                if (isFirstRound) return await (interaction as ChatInputCommandInteraction).editReply(resetMsg);
                else return await (interaction as MessageComponentInteraction).followUp(resetMsg);
            } else {
                // DB rỗng -> Không có câu hỏi nào để chơi
                const emptyMsg = `Kho đạn hệ **${lang.toUpperCase()}** cấp **${profile.level}** hiện đang rỗng. Hãy gọi Admin cày thêm!`;
                if (isFirstRound) return await (interaction as ChatInputCommandInteraction).editReply(emptyMsg);
                else return await (interaction as MessageComponentInteraction).followUp(emptyMsg);
            }
        }

        const quiz = randomQuizArray[0];
        
        // Lưu ID câu hỏi vừa bốc vào bộ nhớ
        profile.playedQuizzes.push(quiz._id);
        await userDoc.save();
        
        const rawOptionsArray = [
            { key: 'A', text: quiz.options.A },
            { key: 'B', text: quiz.options.B },
            { key: 'C', text: quiz.options.C },
            { key: 'D', text: quiz.options.D }
        ];
        if (quiz.options.E) rawOptionsArray.push({ key: 'E', text: quiz.options.E });
        if (quiz.options.F) rawOptionsArray.push({ key: 'F', text: quiz.options.F });
        const correctText = quiz.options[quiz.correctAnswer];
        
        // thuật toán Fisher-Yates để xáo trộn mảng đáp án
        for (let i = rawOptionsArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rawOptionsArray[i], rawOptionsArray[j]] = [rawOptionsArray[j]!, rawOptionsArray[i]!];
        }

        const currentKeys = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, rawOptionsArray.length);
        const mappedOptions: any = {};
        let mappedCorrectAnswer = '';

        rawOptionsArray.forEach((opt, index) => {
            const newKey = currentKeys[index]!;
            mappedOptions[newKey] = opt.text;
            if (opt.text === correctText) mappedCorrectAnswer = newKey;
        });
        
        const tutorialEndNumber = 7;
        const isHideVietnamese = streak >= 3;
        const isHideRecipe = streak >= 5;
        const isHideExplanation = streak >= tutorialEndNumber;

        let descriptionStr = '';
        if (!isHideExplanation && quiz.explanation) descriptionStr += `*${quiz.explanation}*\n\n`;
        if (!isHideRecipe && quiz.recipe) descriptionStr += `**Công thức:**\n\`${quiz.recipe}\`\n\n`;
        if (!isHideVietnamese && quiz.vietnamese) descriptionStr += `**Nghĩa tiếng Việt:**\n ${quiz.vietnamese}\n\n`;
        if (quiz.question) descriptionStr += `**Câu hỏi:**\n ${quiz.question}`;

        const embedFields = currentKeys.map(key => ({
            name: key,
            value: mappedOptions[key] ? String(mappedOptions[key]) : 'Lỗi không có đáp án',
            inline: true
        }));

        const embedTitle = isHideExplanation 
            ? `🎯 Ngữ pháp: [Bị ẩn do Streak ${streak}+]` 
            : `🎯 Ngữ pháp: ${quiz.grammarPoint}`;

        const langIcon = lang === 'jp' ? '🇯🇵' : '🇬🇧';
        const embed = new EmbedBuilder()
            .setColor(streak >= tutorialEndNumber ? '#ED4245' : '#2b2d31')
            .setTitle(embedTitle)
            .setDescription(descriptionStr)
            .addFields(embedFields)
            .setFooter({ text: `${langIcon} Streak: ${streak} | Lvl: ${profile.level} | 🤖 ${quiz.modelUsed} (Cached)` });

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
            if (i.user.id !== userDoc.discordId) {
                await i.reply({ content: 'Chỉ người gọi lệnh mới được chơi!', ephemeral: true });
                return;
            }

            const isCorrect = i.customId === mappedCorrectAnswer;
            components.forEach(row => row.components.forEach((btn: any) => btn.setDisabled(true)));
            const resultEmbed = new EmbedBuilder()
                .setColor(isCorrect ? '#57F287' : '#ED4245')
                .setTitle(isCorrect ? '✅ Chính xác!' : `❌ Sai rồi! Đáp án là ${mappedCorrectAnswer}`)
                .setDescription(`**Giải thích:**\n${quiz.reason}\n\n*Công thức gốc:* \`${quiz.recipe || 'Không có'}\``);

            await i.update({ embeds: [embed, resultEmbed], components });
            collector.stop();
            
            if (isCorrect) {
                profile.streak++;
                if (profile.streak > profile.maxStreak) {
                    profile.maxStreak = profile.streak; 
                }
                await userDoc.save(); 
                await playRound(i, userDoc, false, lang);
            } else {
                const oldStreak = profile.streak;
                profile.streak = 0;
                // Trả lời sai -> Reset trí nhớ để ôn tập lại từ đầu
                profile.playedQuizzes = []; 
                await userDoc.save(); 
                
                await i.followUp({ 
                    content: `😗 Lệch nhịp! Bạn đã đứt chuỗi **${oldStreak} streak** hệ ${lang.toUpperCase()}. Hãy gõ \`/quiz\` để bắt đầu lại!`, 
                    ephemeral: false 
                });
            }
        });

    } catch (error) {
        console.error(error);
        const errorMsg = "Hệ thống truy xuất dữ liệu đang gặp trục trặc.";
        if (isFirstRound) await (interaction as ChatInputCommandInteraction).editReply(errorMsg);
        else await (interaction as MessageComponentInteraction).followUp(errorMsg);
    }
}