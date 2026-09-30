import { get, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { AnomalyResult, AttritionResult, ChatReply } from '@/types/ai';

export const aiService = {
  chat: (message: string) => post<ChatReply>(E.ai.chat, { message }),
  anomalies: (days = 30) => get<AnomalyResult>(E.ai.anomalies, { days }),
  attrition: () => get<AttritionResult>(E.ai.attrition),
};
