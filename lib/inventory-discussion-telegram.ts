import {
  activateInventoryDiscussionSessionInDb,
  clearInventoryDiscussionSessionInDb,
  clearInventoryDiscussionSessionsByThreadIdInDb,
  closeInventoryDiscussionThreadInDb,
  createInventoryDiscussionMessageInDb,
  createInventoryDiscussionRequestInDb,
  findActiveInventoryDiscussionSessionByUserIdInDb,
  findInventoryDiscussionThreadByIdInDb,
  takeInventoryDiscussionThreadInDb,
  type InventoryDiscussionThreadRecord
} from '@/lib/inventory-discussions-repository';
import { createInventoryNotificationLogInDb } from '@/lib/inventory-notification-logs-repository';
import {
  answerInventoryTelegramCallback,
  sendInventoryTelegramMessage,
  type InventoryTelegramInlineButton
} from '@/lib/inventory-telegram-api';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { canManageInventoryUsers, type InventoryUserRole } from '@/lib/inventory-user-roles';
import { findInventoryUserByChatId, listInventoryUsersFromDb, type InventoryUserRecord } from '@/lib/inventory-users-repository';

const OPEN_DISCUSSION_CALLBACK_PREFIX = 'discussion_open:';
const CLOSE_DISCUSSION_CALLBACK_PREFIX = 'discussion_close:';

function getUserDisplayName(user: {
  surname?: string;
  name?: string;
}) {
  return [user.surname, user.name].filter(Boolean).join(' ').trim() || 'Користувач';
}

function getThreadRequesterDisplayName(thread: InventoryDiscussionThreadRecord) {
  return [thread.requesterSurname, thread.requesterName].filter(Boolean).join(' ').trim() || 'Працівник';
}

function getThreadSubject(thread: InventoryDiscussionThreadRecord) {
  return `${thread.productName || 'Товар'} • партія #${thread.batchId}`;
}

function buildManagerButtons(threadId: number, isTaken = false): InventoryTelegramInlineButton[][] {
  return [
    [
      {
        text: isTaken ? 'Відкрити мій діалог' : 'Відкрити діалог',
        callbackData: `${OPEN_DISCUSSION_CALLBACK_PREFIX}${threadId}`
      },
      {
        text: 'Закрити діалог',
        callbackData: `${CLOSE_DISCUSSION_CALLBACK_PREFIX}${threadId}`
      }
    ]
  ];
}

function buildWorkerCloseButtons(threadId: number): InventoryTelegramInlineButton[][] {
  return [[{ text: 'Закрити діалог', callbackData: `${CLOSE_DISCUSSION_CALLBACK_PREFIX}${threadId}` }]];
}

function discussionManagersForStore(users: InventoryUserRecord[]) {
  return users.filter(
    (user) =>
      user.isActive &&
      Boolean(user.userChatId) &&
      (user.role === 'store_manager' || user.role === 'manager')
  );
}

async function sendDiscussionMessageToChat(input: {
  chatId: string;
  text: string;
  buttons?: InventoryTelegramInlineButton[][];
}) {
  const settings = await getInventoryTelegramSettingsFromDb();
  if (!settings.enabled || !settings.botToken) {
    throw new Error('Telegram inventory integration is not fully configured.');
  }

  await sendInventoryTelegramMessage({
    botToken: settings.botToken,
    chatId: input.chatId,
    text: input.text,
    buttons: input.buttons
  });
}

async function answerDiscussionCallbackIfNeeded(input: {
  callbackQueryId: string;
  text?: string;
}) {
  if (!input.callbackQueryId || input.callbackQueryId.startsWith('command:')) {
    return;
  }

  const settings = await getInventoryTelegramSettingsFromDb();
  if (!settings.enabled || !settings.botToken) return;

  await answerInventoryTelegramCallback({
    botToken: settings.botToken,
    callbackQueryId: input.callbackQueryId,
    text: input.text
  });
}

export async function notifyInventoryDiscussionCreated(input: {
  taskId?: number | null;
  batchId: number;
  productId: number;
  storeId: number;
  requesterUserId: number;
  requesterRole: InventoryUserRole;
  requesterName: string;
  requesterSurname: string;
  snapshotNote: string;
}) {
  const title = `Обговорення: ${input.requesterSurname} ${input.requesterName}`.trim();
  const { thread, message } = await createInventoryDiscussionRequestInDb({
    taskId: input.taskId ?? null,
    batchId: input.batchId,
    productId: input.productId,
    storeId: input.storeId,
    requesterUserId: input.requesterUserId,
    requesterRole: input.requesterRole,
    title,
    messageText: input.snapshotNote
  });

  await activateInventoryDiscussionSessionInDb({
    userId: input.requesterUserId,
    threadId: thread.id,
    sessionRole: 'requester'
  });

  const storeUsers = await listInventoryUsersFromDb({ storeId: input.storeId, limit: 200 });
  const managers = discussionManagersForStore(storeUsers);
  const requesterDisplayName = getUserDisplayName({
    surname: input.requesterSurname,
    name: input.requesterName
  });

  const text = [
    'Працівник просить обговорення по товару.',
    `Працівник: ${requesterDisplayName}`,
    thread.storeLabel ? `Магазин: ${thread.storeLabel}` : '',
    `Товар: ${getThreadSubject(thread)}`,
    '',
    `Повідомлення: ${message.messageText}`
  ]
    .filter(Boolean)
    .join('\n');

  for (const manager of managers) {
    await sendDiscussionMessageToChat({
      chatId: manager.userChatId,
      text,
      buttons: buildManagerButtons(thread.id)
    });

    await createInventoryNotificationLogInDb({
      taskId: input.taskId ?? null,
      batchId: input.batchId,
      productId: input.productId,
      storeId: input.storeId,
      userId: manager.id,
      notificationType: 'inventory_discussion_request',
      messageText: text
    });
  }

  return thread;
}

async function sendWorkerReplyRequestToManagers(thread: InventoryDiscussionThreadRecord, text: string) {
  const storeUsers = await listInventoryUsersFromDb({ storeId: thread.storeId, limit: 200 });
  const managers = discussionManagersForStore(storeUsers);

  for (const manager of managers) {
    await sendDiscussionMessageToChat({
      chatId: manager.userChatId,
      text,
      buttons: buildManagerButtons(thread.id, thread.managerUserId === manager.id)
    });
  }
}

export async function handleInventoryDiscussionCallback(input: {
  callbackQueryId: string;
  data: string;
  telegramUserChatId: string;
}) {
  const settings = await getInventoryTelegramSettingsFromDb();
  if (!settings.enabled || !settings.botToken) {
    return { handled: false, reason: 'integration_not_configured' as const };
  }

  const user = await findInventoryUserByChatId(input.telegramUserChatId);
  if (!user || !user.isActive) {
    await answerInventoryTelegramCallback({
      botToken: settings.botToken,
      callbackQueryId: input.callbackQueryId,
      text: 'Користувача не знайдено.'
    });
    return { handled: true, reason: 'unknown_user' as const };
  }

  const isOpenAction = input.data.startsWith(OPEN_DISCUSSION_CALLBACK_PREFIX);
  const isCloseAction = input.data.startsWith(CLOSE_DISCUSSION_CALLBACK_PREFIX);
  if (!isOpenAction && !isCloseAction) {
    return { handled: false, reason: 'unsupported_callback' as const };
  }

  const threadId = Number(input.data.split(':')[1] ?? 0);
  const thread = await findInventoryDiscussionThreadByIdInDb(threadId);
  if (!thread) {
    await answerInventoryTelegramCallback({
      botToken: settings.botToken,
      callbackQueryId: input.callbackQueryId,
      text: 'Діалог не знайдено.'
    });
    return { handled: true, reason: 'thread_not_found' as const };
  }

  if (isOpenAction) {
    if (!canManageInventoryUsers(user.role)) {
      await answerInventoryTelegramCallback({
        botToken: settings.botToken,
        callbackQueryId: input.callbackQueryId,
        text: 'Відкрити діалог може лише керівник або замісник.'
      });
      return { handled: true, reason: 'forbidden' as const };
    }

    let takenThread: InventoryDiscussionThreadRecord;
    try {
      takenThread = await takeInventoryDiscussionThreadInDb({
        threadId: thread.id,
        managerUserId: user.id
      });
    } catch (error) {
      await answerInventoryTelegramCallback({
        botToken: settings.botToken,
        callbackQueryId: input.callbackQueryId,
        text: error instanceof Error ? error.message : 'Не вдалося відкрити діалог.'
      });
      return { handled: true, reason: 'discussion_open_failed' as const };
    }

    await activateInventoryDiscussionSessionInDb({
      userId: user.id,
      threadId: takenThread.id,
      sessionRole: 'manager'
    });
    await activateInventoryDiscussionSessionInDb({
      userId: takenThread.requesterUserId,
      threadId: takenThread.id,
      sessionRole: 'requester'
    });

    await answerInventoryTelegramCallback({
      botToken: settings.botToken,
      callbackQueryId: input.callbackQueryId,
      text: 'Діалог відкрито.'
    });

    const managerDisplayName = getUserDisplayName(user);
    await sendDiscussionMessageToChat({
      chatId: user.userChatId,
      text: [
        `Ви відкрили діалог з працівником ${getThreadRequesterDisplayName(takenThread)}.`,
        `Товар: ${getThreadSubject(takenThread)}`,
        'Ваші наступні повідомлення в цьому чаті будуть надіслані саме цьому працівнику.'
      ].join('\n'),
      buttons: buildManagerButtons(takenThread.id, true)
    });

    if (takenThread.requesterChatId) {
      await sendDiscussionMessageToChat({
        chatId: takenThread.requesterChatId,
        text: [
          `${managerDisplayName} відкрив діалог по вашому зверненню.`,
          `Товар: ${getThreadSubject(takenThread)}`,
          'Можете писати відповідь у цьому чаті.'
        ].join('\n'),
        buttons: buildWorkerCloseButtons(takenThread.id)
      });
    }

    return { handled: true, reason: 'discussion_opened' as const, threadId: takenThread.id };
  }

  const allowedCloser =
    user.id === thread.requesterUserId ||
    user.id === thread.managerUserId ||
    canManageInventoryUsers(user.role);
  if (!allowedCloser) {
    await answerInventoryTelegramCallback({
      botToken: settings.botToken,
      callbackQueryId: input.callbackQueryId,
      text: 'У вас немає доступу до цього діалогу.'
    });
    return { handled: true, reason: 'forbidden_close' as const };
  }

  let closedThread: InventoryDiscussionThreadRecord;
  try {
    closedThread = await closeInventoryDiscussionThreadInDb({
      threadId: thread.id,
      closedByUserId: user.id
    });
  } catch (error) {
    await answerInventoryTelegramCallback({
      botToken: settings.botToken,
      callbackQueryId: input.callbackQueryId,
      text: error instanceof Error ? error.message : 'Не вдалося закрити діалог.'
    });
    return { handled: true, reason: 'discussion_close_failed' as const };
  }
  await clearInventoryDiscussionSessionsByThreadIdInDb(closedThread.id);

  await answerInventoryTelegramCallback({
    botToken: settings.botToken,
    callbackQueryId: input.callbackQueryId,
    text: 'Діалог закрито.'
  });

  const closedByName = getUserDisplayName(user);
  if (closedThread.requesterChatId) {
    await sendDiscussionMessageToChat({
      chatId: closedThread.requesterChatId,
      text: `${closedByName} закрив діалог по товару ${getThreadSubject(closedThread)}.`
    });
  }
  if (closedThread.managerChatId) {
    await sendDiscussionMessageToChat({
      chatId: closedThread.managerChatId,
      text: `Діалог по товару ${getThreadSubject(closedThread)} закрито.`
    });
  }

  return { handled: true, reason: 'discussion_closed' as const, threadId: closedThread.id };
}

export async function handleInventoryDiscussionCommand(input: {
  telegramUserChatId: string;
  text: string;
}) {
  const trimmed = input.text.trim();
  const openMatch = trimmed.match(/^\/discussion_open_(\d+)$/i);
  const closeMatch = trimmed.match(/^\/discussion_close_(\d+)$/i);

  if (!openMatch && !closeMatch) {
    return { handled: false, reason: 'unsupported_discussion_command' as const };
  }

  const fakeCallbackId = `command:${Date.now()}`;
  const data = openMatch
    ? `${OPEN_DISCUSSION_CALLBACK_PREFIX}${openMatch[1]}`
    : `${CLOSE_DISCUSSION_CALLBACK_PREFIX}${closeMatch?.[1] ?? ''}`;

  try {
    return await handleInventoryDiscussionCallback({
      callbackQueryId: fakeCallbackId,
      data,
      telegramUserChatId: input.telegramUserChatId
    });
  } catch {
    return { handled: false, reason: 'discussion_command_failed' as const };
  }
}

export async function handleInventoryDiscussionTextMessage(input: {
  telegramUserChatId: string;
  text: string;
}) {
  const user = await findInventoryUserByChatId(input.telegramUserChatId);
  if (!user || !user.isActive) {
    return { handled: false, reason: 'unknown_user' as const };
  }

  const activeSession = await findActiveInventoryDiscussionSessionByUserIdInDb(user.id);
  if (!activeSession?.thread) {
    return { handled: false, reason: 'no_active_discussion' as const };
  }

  const thread = activeSession.thread;
  if (thread.status !== 'open') {
    await clearInventoryDiscussionSessionInDb(user.id);
    return { handled: true, reason: 'discussion_already_closed' as const };
  }

  if (user.id === thread.requesterUserId) {
    const message = await createInventoryDiscussionMessageInDb({
      threadId: thread.id,
      senderUserId: user.id,
      recipientUserId: thread.managerUserId ?? null,
      senderRole: user.role,
      channel: 'telegram',
      messageText: input.text
    });

    if (thread.managerChatId) {
      await sendDiscussionMessageToChat({
        chatId: thread.managerChatId,
        text: [
          `Відповідь працівника ${getThreadRequesterDisplayName(thread)}.`,
          `Товар: ${getThreadSubject(thread)}`,
          '',
          message.messageText
        ].join('\n'),
        buttons: buildManagerButtons(thread.id, true)
      });
    } else {
      await sendWorkerReplyRequestToManagers(
        thread,
        [
          `Працівник ${getThreadRequesterDisplayName(thread)} доповнив обговорення.`,
          `Товар: ${getThreadSubject(thread)}`,
          '',
          message.messageText
        ].join('\n')
      );
    }

    return { handled: true, reason: 'worker_message_forwarded' as const, threadId: thread.id };
  }

  if (thread.managerUserId && user.id === thread.managerUserId) {
    const message = await createInventoryDiscussionMessageInDb({
      threadId: thread.id,
      senderUserId: user.id,
      recipientUserId: thread.requesterUserId,
      senderRole: user.role,
      channel: 'telegram',
      messageText: input.text
    });

    if (thread.requesterChatId) {
      await sendDiscussionMessageToChat({
        chatId: thread.requesterChatId,
        text: [
          `Відповідь керівника по товару ${getThreadSubject(thread)}.`,
          '',
          message.messageText
        ].join('\n'),
        buttons: buildWorkerCloseButtons(thread.id)
      });
    }

    return { handled: true, reason: 'manager_message_forwarded' as const, threadId: thread.id };
  }

  return { handled: false, reason: 'user_not_thread_participant' as const };
}
