import { supabase } from '../lib/supabase';

/**
 * Validates if a stage can be started by the current user.
 */
export const canStartStage = async (orderId: string, stageId: string, userId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('can_start_stage', { 
    p_order_id: orderId, 
    p_stage_id: stageId, 
    p_user_id: userId 
  });
  if (error) throw error;
  return data as boolean;
};

/**
 * Checks if upstream dependencies are unmet.
 */
export const isStageBlocked = async (orderId: string, stageId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('is_stage_blocked', { 
    p_order_id: orderId, 
    p_stage_id: stageId 
  });
  if (error) throw error;
  return data as boolean;
};

/**
 * Calculates the SLA status based on current time and planned date.
 */
export const calculateSLAStatus = (plannedDate: string | null, actualDate: string | null): string => {
  if (!plannedDate) return 'NOT_STARTED';
  if (actualDate) {
    return new Date(actualDate) <= new Date(plannedDate) ? 'ON_TIME' : 'OVERDUE_COMPLETED';
  }
  
  const now = new Date();
  const deadline = new Date(plannedDate);
  const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) return 'OVERDUE';
  if (diffHours <= 1) return 'DUE_SOON';
  return 'IN_PROGRESS';
};

/**
 * Atomically completes a stage and advances the workflow.
 */
export const completeStage = async (orderStageId: string, userId: string, checklistPayload: Record<string, string>) => {
  const { data, error } = await supabase.rpc('complete_stage', {
    p_order_stage_id: orderStageId,
    p_user_id: userId,
    p_checklist_payload: checklistPayload
  });
  
  if (error) {
    throw new Error(Stage completion failed:  + error.message);
  }
  return data;
};
