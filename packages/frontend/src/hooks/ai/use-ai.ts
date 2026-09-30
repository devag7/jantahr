'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { aiService } from '@/services/ai/ai.service';

export const useChat = () => useApiMutation((message: string) => aiService.chat(message), { silentError: true });
export const useAnomalies = (days: number) => useQuery({ queryKey: ['ai', 'anomalies', days], queryFn: () => aiService.anomalies(days) });
export const useAttritionRisk = () => useQuery({ queryKey: ['ai', 'attrition'], queryFn: aiService.attrition });
