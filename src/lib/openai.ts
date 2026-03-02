import OpenAI from 'openai';

// OpenAIクライアントを遅延初期化（ビルド時にエラーを防ぐ）
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY環境変数が設定されていません');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export async function generateText(prompt: string, userInput: Record<string, string>): Promise<string> {
  const openai = getOpenAI();
  
  // プロンプト内の変数を置換
  let finalPrompt = prompt;
  for (const [key, value] of Object.entries(userInput)) {
    finalPrompt = finalPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'あなたはプロフェッショナルなコンテンツ作成アシスタントです。日本語で高品質なコンテンツを生成してください。',
      },
      {
        role: 'user',
        content: finalPrompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  return response.choices[0]?.message?.content || '';
}

export async function generateImage(prompt: string): Promise<string> {
  const openai = getOpenAI();
  
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
  });

  return response.data?.[0]?.url || '';
}
