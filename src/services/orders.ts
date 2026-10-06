import { supabase } from '../lib/supabase';

export interface OrderFilter {
  search?: string;
  customerId?: string;
  salesmanId?: string;
  status?: string;
  isArchived?: boolean;
  cnApplicable?: boolean;
  page?: number;
  pageSize?: number;
}

export const fetchOrders = async (filters: OrderFilter) => {
  let query = supabase.from('orders').select('*, customers(name), profiles(full_name), order_stages(stage_id, status, planned_date)', { count: 'exact' });

  if (filters.search) {
    query = query.ilike('submission_id', %\%);
  }
  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters.salesmanId) {
    query = query.eq('salesman_id', filters.salesmanId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.isArchived !== undefined) {
    query = query.eq('is_archived', filters.isArchived);
  }
  if (filters.cnApplicable !== undefined) {
    query = query.eq('cn_applicable', filters.cnApplicable);
  }

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.range(from, to).order('created_at', { ascending: false });

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, count };
};

export const createOrder = async (orderData: any, firstStageId: string) => {
  // Creating an order and initializing workflow should be atomic, we use an RPC
  const { data, error } = await supabase.rpc('create_new_order', {
    p_submission_id: orderData.submission_id,
    p_customer_id: orderData.customer_id,
    p_delivery_address_id: orderData.delivery_address_id,
    p_salesman_id: orderData.salesman_id,
    p_cn_applicable: orderData.cn_applicable,
    p_first_stage_id: firstStageId
  });

  if (error) throw error;
  return data;
};

export const fetchOrderById = async (id: string) => {
  const { data, error } = await supabase
    .from('orders')
    .select(
      *,
      customers(*),
      customer_addresses(*),
      profiles(full_name),
      order_stages(
        *,
        workflow_stages(stage_name, sequence_order)
      ),
      documents(*),
      audit_logs(*)
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};
