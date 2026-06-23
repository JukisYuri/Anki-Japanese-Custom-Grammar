import { Client, GatewayIntentBits, Collection, MessageFlags } from 'discord.js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
(client as any).commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = `file://${path.join(commandsPath, file)}`;
    
    import(filePath).then((module) => {
        const command = module.command;
        if ('data' in command && 'execute' in command) {
            (client as any).commands.set(command.data.name, command);
            console.log(`[Command] Đã nạp thành công lệnh: /${command.data.name}`);
        } else {
            console.warn(`[Cảnh báo] File ${file} thiếu thuộc tính 'data' hoặc 'execute' bắt buộc.`);
        }
    });
}

// Đăng ký các slash command lên Discord API
client.once('ready', async () => {
    console.log(`${client.user?.tag} đã kết nối!`);
    
    try {
        const commandsData = (client as any).commands.map((cmd: any) => cmd.data.toJSON());
        await client.application?.commands.set(commandsData);
        console.log(`Đã đồng bộ ${commandsData.length} lệnh lên Discord.`);
    } catch (error) {
        console.error("Lỗi khi đăng ký lệnh:", error);
    }
});

// Lắng nghe và thực thi
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;
    
    const command = (client as any).commands.get(interaction.commandName);
    if (!command) return console.error(`Không tìm thấy lệnh ${interaction.commandName} trong bộ nhớ bot.`);

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Lỗi khi thực thi lệnh ${interaction.commandName}:`, error);
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Đã có lỗi xảy ra khi chạy lệnh này!', flags: [MessageFlags.Ephemeral] });
        } else {
            await interaction.reply({ content: 'Đã có lỗi xảy ra khi chạy lệnh này!', flags: [MessageFlags.Ephemeral] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);