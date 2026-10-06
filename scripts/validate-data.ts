import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function validateData() {
  console.log('--- Phase 2: Validation ---');
  
  const { data: stgData, error } = await supabase.from('stg_raw_orders').select('*');
  if (error) throw error;

  const { data: customers } = await supabase.from('customers').select('id, name');
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, email');

  const customerMap = new Map(customers?.map(c => [c.name?.trim().toUpperCase(), c.id]));
  const profileMap = new Map(profiles?.map(p => [p.email?.trim().toLowerCase(), p.id]));

  const errors: any[] = [];
  const validRecords: any[] = [];

  for (const record of stgData || []) {
    const row = record.raw_payload;
    const submissionId = record.submission_id;
    const rowErrors: string[] = [];

    // 1. Check missing customers
    const cName = row['Customer Name']?.trim().toUpperCase();
    if (!cName || !customerMap.has(cName)) {
      rowErrors.push(MISSING_CUSTOMER: '\' not found in master data.);
    }

    // 2. Check users
    const sEmail = row['Salesman Email ID']?.trim().toLowerCase();
    if (sEmail && !profileMap.has(sEmail)) {
      rowErrors.push(INVALID_USER: Salesman '\' not found in profiles.);
    }

    // 3. Check invalid dates
    const rawDate = row['Timestamp'];
    if (!rawDate || isNaN(Date.parse(new Date((rawDate - (25567 + 2)) * 86400 * 1000).toISOString()))) {
       rowErrors.push(INVALID_DATE: Timestamp '\' cannot be parsed.);
    }

    if (rowErrors.length > 0) {
      errors.push({ submission_id: submissionId, errors: rowErrors, raw: row });
    } else {
      validRecords.push({ submission_id: submissionId, customer_id: customerMap.get(cName), salesman_id: profileMap.get(sEmail), raw: row });
    }
  }

  // Generate Reports
  const reportDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);

  fs.writeFileSync(path.join(reportDir, 'migration-error-report.json'), JSON.stringify(errors, null, 2));
  fs.writeFileSync(path.join(reportDir, 'migration-valid-records.json'), JSON.stringify(validRecords, null, 2));

  const summary = {
    total_records: stgData?.length || 0,
    valid_ready_for_import: validRecords.length,
    failed_validation: errors.length,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(reportDir, 'migration-summary.json'), JSON.stringify(summary, null, 2));

  console.log('Validation complete. Reports generated in /reports/');
  console.log(summary);
}

validateData().catch(console.error);
