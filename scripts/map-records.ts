import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function mapRecords() {
  console.log('--- Phase 3: Map & Migrate to Production ---');
  const validRecordsPath = path.join(__dirname, '..', 'reports', 'migration-valid-records.json');
  
  if (!fs.existsSync(validRecordsPath)) {
    console.error("No valid records found. Run validate-data script first.");
    return;
  }

  const records = JSON.parse(fs.readFileSync(validRecordsPath, 'utf8'));
  const successLog: any[] = [];
  const failLog: any[] = [];

  for (const record of records) {
    try {
      // Create Production Order
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        submission_id: record.submission_id,
        customer_id: record.customer_id,
        salesman_id: record.salesman_id,
        created_at: new Date((record.raw['Timestamp'] - (25567 + 2)) * 86400 * 1000).toISOString(),
        status: record.raw['Archive Data'] === 'Yes' ? 'Completed' : 'Active',
        is_archived: record.raw['Archive Data'] === 'Yes'
      }).select('id').single();

      if (orderError) throw orderError;

      // Migrate Invoice details if present
      if (record.raw['Invoice Number']) {
        await supabase.from('invoices').insert({
          order_id: order.id,
          invoice_number: record.raw['Invoice Number'],
          invoice_amount: record.raw['Invoice Amount'] || 0,
          quantity: record.raw['Qty'] || 0
        });
      }

      successLog.push({ submission_id: record.submission_id, order_id: order.id });
    } catch (err: any) {
      console.error(Failed to migrate record \:, err.message);
      failLog.push({ submission_id: record.submission_id, error: err.message });
    }
  }

  const reportDir = path.join(__dirname, '..', 'reports');
  fs.writeFileSync(path.join(reportDir, 'migration-success-report.json'), JSON.stringify(successLog, null, 2));
  if (failLog.length > 0) {
    fs.writeFileSync(path.join(reportDir, 'migration-production-failures.json'), JSON.stringify(failLog, null, 2));
  }
  
  console.log(Migration to production complete. Successfully migrated \ orders.);
}

mapRecords().catch(console.error);
