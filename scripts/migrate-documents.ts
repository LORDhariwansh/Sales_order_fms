import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function migrateDocuments() {
  console.log('--- Phase 4: Migrate Legacy Documents ---');
  const validRecordsPath = path.join(__dirname, '..', 'reports', 'migration-valid-records.json');
  const successReportPath = path.join(__dirname, '..', 'reports', 'migration-success-report.json');

  if (!fs.existsSync(successReportPath)) {
    console.error("Orders must be migrated to production before mapping documents.");
    return;
  }

  const validRecords = JSON.parse(fs.readFileSync(validRecordsPath, 'utf8'));
  const successLog = JSON.parse(fs.readFileSync(successReportPath, 'utf8'));
  
  // Map submission_id to production order_id
  const orderIdMap = new Map(successLog.map((log: any) => [log.submission_id, log.order_id]));

  for (const record of validRecords) {
    const orderId = orderIdMap.get(record.submission_id);
    if (!orderId) continue;

    const legacyDocs = [
      { type: 'Gatepass', url: record.raw['Gate Pass Upload'] },
      { type: 'Invoice', url: record.raw['New Invoice Upload'] },
      { type: 'Bilty', url: record.raw['New Bility Upload'] }
    ].filter(d => d.url && d.url.startsWith('http'));

    for (const doc of legacyDocs) {
      await supabase.from('documents').insert({
        order_id: orderId,
        document_type: doc.type,
        storage_path: doc.url, // Preserving legacy Google Drive URL as path
        file_name: 'Legacy Migration File',
        mime_type: 'unknown',
        file_size: 0,
        version: 1
      });
    }
  }
  
  console.log('Legacy document URLs mapped successfully.');
}

migrateDocuments().catch(console.error);
