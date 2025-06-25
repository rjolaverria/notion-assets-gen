import { GoogleGenAI, Modality } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const IMAGE_SYSTEM_PROMPT = `
[Role]
 You are an AI that generates images based on text descriptions.
 You will receive a text description and you must generate an image that matches the description.
 You will also recieve context from the Notion page, which may include additional details or instructions.
 
[Instructions]
 - Generate an image that matches the description provided.
 - The image should be relevant to the context provided.
 - Never include any text in the image unless specified to explicitly.
`;

@Injectable()
export class GenaiService {
  private client: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateImage(context: string, contents = '') {
    const systemPrompt = `${IMAGE_SYSTEM_PROMPT}
  
[Context] 
 ${context}

[Request]
  ${contents}
  `;
    const response = await this.client.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: systemPrompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const parts = response?.candidates?.[0]?.content?.parts;

    if (!parts || parts.length === 0) {
      return null;
    }

    for (const part of parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data || '';
        const buffer = Buffer.from(imageData, 'base64');
        return buffer;
      }
    }
    return null;
  }
}
