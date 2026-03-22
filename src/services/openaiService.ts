import OpenAI from 'openai';

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'MY_OPENAI_API_KEY') {
    throw new Error("OpenAI API Key is not configured. Please set OPENAI_API_KEY in your environment variables.");
  }
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
  });
};

export const openAIVision = async (prompt: string, base64Data: string, mimeType: string) => {
  const client = getOpenAIClient();
  
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`,
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" }
  });

  return response.choices[0].message.content;
};

export const openAIChat = async (messages: any[], systemInstruction?: string) => {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
      ...messages
    ],
  });
  return response.choices[0].message.content;
};

export const openAIJson = async (prompt: string, schema?: any) => {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant that outputs JSON.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  });
  return response.choices[0].message.content;
};
export const aiVision = async (prompt: string, imageBase64: string, mimeType: string): Promise<string | null> => {
  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('API key not found');
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
          ]
        }],
        max_tokens: 1000
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('aiVision error:', error);
    return null;
  }
};
