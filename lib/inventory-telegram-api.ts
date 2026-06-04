export type InventoryTelegramInlineButton = {
  text: string;
  url?: string;
  callbackData?: string;
};

async function callTelegramApi(botToken: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const description =
      payload && typeof payload === 'object' && typeof (payload as { description?: unknown }).description === 'string'
        ? (payload as { description: string }).description
        : '';
    throw new Error(`Telegram API ${method} failed with ${response.status}${description ? `: ${description}` : '.'}`);
  }

  return payload;
}

async function callTelegramApiFormData(botToken: string, method: string, body: FormData) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    body
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const description =
      payload && typeof payload === 'object' && typeof (payload as { description?: unknown }).description === 'string'
        ? (payload as { description: string }).description
        : '';
    throw new Error(`Telegram API ${method} failed with ${response.status}${description ? `: ${description}` : '.'}`);
  }

  return payload;
}

function isLikelyTelegramSafeUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'tg:'].includes(url.protocol)) return false;

    const host = url.hostname.trim().toLowerCase();
    if (!host && url.protocol !== 'tg:') return false;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;

    return true;
  } catch {
    return false;
  }
}

export async function sendInventoryTelegramMessage(input: {
  botToken: string;
  chatId: string;
  text: string;
  buttonText?: string;
  buttonUrl?: string;
  buttons?: InventoryTelegramInlineButton[][];
}) {
  type TelegramInlineKeyboardButton = { text: string; url: string } | { text: string; callback_data: string };
  const safeButtonUrl = input.buttonUrl?.trim() && isLikelyTelegramSafeUrl(input.buttonUrl) ? input.buttonUrl.trim() : '';
  const inlineKeyboard =
    input.buttons && input.buttons.length > 0
      ? input.buttons.map((row) =>
          row
            .map((button) => {
              const safeUrl = button.url?.trim() && isLikelyTelegramSafeUrl(button.url) ? button.url.trim() : '';
              if (button.callbackData?.trim()) {
                return { text: button.text, callback_data: button.callbackData.trim() } satisfies TelegramInlineKeyboardButton;
              }
              if (safeUrl) {
                return { text: button.text, url: safeUrl } satisfies TelegramInlineKeyboardButton;
              }
              return null;
            })
            .filter((button): button is TelegramInlineKeyboardButton => button != null)
        )
      : input.buttonText && safeButtonUrl
        ? [[{ text: input.buttonText, url: safeButtonUrl }]]
        : [];
  const replyMarkup = inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined;

  try {
    return await callTelegramApi(input.botToken, 'sendMessage', {
      chat_id: input.chatId,
      text: input.text,
      reply_markup: replyMarkup
    });
  } catch (error) {
    const usesCallbackButtons = inlineKeyboard.some((row) => row.some((button) => 'callback_data' in button));
    if (!replyMarkup || usesCallbackButtons) {
      throw error;
    }

    const fallbackText = safeButtonUrl ? `${input.text}\n\n${safeButtonUrl}` : input.text;
    return callTelegramApi(input.botToken, 'sendMessage', {
      chat_id: input.chatId,
      text: fallbackText
    });
  }
}

export async function answerInventoryTelegramCallback(input: {
  botToken: string;
  callbackQueryId: string;
  text?: string;
}) {
  return callTelegramApi(input.botToken, 'answerCallbackQuery', {
    callback_query_id: input.callbackQueryId,
    text: input.text?.trim() || undefined
  });
}

export async function sendInventoryTelegramDocument(input: {
  botToken: string;
  chatId: string;
  file: File | Blob;
  fileName?: string;
  caption?: string;
}) {
  const formData = new FormData();
  formData.append('chat_id', input.chatId);
  if (input.caption?.trim()) {
    formData.append('caption', input.caption.trim());
  }

  const documentFileName =
    input.fileName?.trim() ||
    (typeof File !== 'undefined' && input.file instanceof File && input.file.name ? input.file.name : 'attachment');

  formData.append('document', input.file, documentFileName);
  return callTelegramApiFormData(input.botToken, 'sendDocument', formData);
}
