const ANKI_URL = 'http://127.0.0.1:8765';

export interface VocabCard {
    vocab: string;
    meaning: string;
}

// Hàm core để gọi AnkiConnect API
async function invoke<T>(action: string, params = {}): Promise<T> {
    try {
        const response = await fetch(ANKI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action,
                version: 6,
                params
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        return data.result;
    } catch (error) {
        console.error(`[AnkiConnect Error] Action: ${action}`);
        console.error("VUI LÒNG KIỂM TRA: Anki đã bật chưa và có đang bị kẹt ở cửa sổ Popup nào không?");
        throw error;
    }
}

export async function getGachaVocab(): Promise<VocabCard[]> {
    // Dùng cú pháp search của Anki. 
    // prop:ivl>=21 là Mature, prop:ivl<21 là Young.
    const deckName = "Kaishi 1.5k";
    const matureCardIds = await invoke<number[]>('findCards', { 
        query: `"deck:${deckName}" "prop:ivl>=21"` 
    });
    const youngCardIds = await invoke<number[]>('findCards', { 
        query: `"deck:${deckName}" "prop:ivl<21" (is:review OR is:learn)` 
    });

    // Trộn mảng và bốc thẻ Mature, thẻ Young
    const selectedIds = [
        ...matureCardIds.sort(() => 0.5 - Math.random()).slice(0, 1),
        ...youngCardIds.sort(() => 0.5 - Math.random()).slice(0, 4)
    ];

    if (selectedIds.length === 0) return [];

    const cardsInfo = await invoke<any[]>('cardsInfo', { cards: selectedIds });
    console.log("Danh sách các trường (fields) trong Anki của bạn là:\n", Object.keys(cardsInfo[0].fields));
     
    return cardsInfo.map(card => {
        // Ưu tiên lấy Kanji, nếu từ đó không có Kanji thì lấy Kana
        const vocabRaw = card.fields['Word']?.value || card.fields['Word Reading']?.value;
                      
        // Lấy nghĩa tiếng Anh
        const meaningRaw = card.fields['Word Meaning']?.value;
        
        return {
            vocab: vocabRaw.replace(/<[^>]+>/g, '').trim(),
            meaning: meaningRaw.replace(/<[^>]+>/g, '').trim()
        };
    });
}