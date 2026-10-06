import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface DocumentManagerProps {
  orderId: string;
  activeOrderStageId?: string; // Tying uploads to the active stage
  requiredDocumentType?: string; // Optionally force the user to upload a specific doc
}

const fetchDocuments = async (orderId: string) => {
  const { data, error } = await supabase
    .from('documents')
    .select('*, profiles(full_name), order_stages(workflow_stages(stage_name))')
    .eq('order_id', orderId)
    .order('document_type', { ascending: true })
    .order('version', { ascending: false });

  if (error) throw error;
  return data;
};

export const DocumentManager: Component<DocumentManagerProps> = (props) => {
  const auth = useAuth();
  const [documents, { refetch }] = createResource(() => props.orderId, fetchDocuments);
  
  const [uploading, setUploading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal('');
  const [docType, setDocType] = createSignal(props.requiredDocumentType || 'Gatepass');
  const [file, setFile] = createSignal<File | null>(null);

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  const maxSizeBytes = 20 * 1024 * 1024; // 20 MB

  const handleUpload = async (e: Event) => {
    e.preventDefault();
    const currentFile = file();
    if (!currentFile) return;

    setErrorMsg('');
    if (!allowedTypes.includes(currentFile.type)) {
      setErrorMsg('Invalid file type. Only PDF, JPG, PNG allowed.');
      return;
    }
    if (currentFile.size > maxSizeBytes) {
      setErrorMsg('File exceeds 20MB limit.');
      return;
    }

    setUploading(true);
    try {
      const existingDocs = documents()?.filter(d => d.document_type === docType()) || [];
      const nextVersion = existingDocs.length > 0 ? Math.max(...existingDocs.map(d => d.version)) + 1 : 1;

      const fileExt = currentFile.name.split('.').pop();
      const storagePath = \/\_v\_\.\;

      const { error: uploadError } = await supabase.storage
        .from('fms-documents')
        .upload(storagePath, currentFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documents').insert({
        order_id: props.orderId,
        order_stage_id: props.activeOrderStageId || null,
        document_type: docType(),
        storage_path: storagePath,
        file_name: currentFile.name,
        mime_type: currentFile.type,
        file_size: currentFile.size,
        version: nextVersion,
        uploaded_by: auth.user?.id
      });

      if (dbError) throw dbError;
      
      setFile(null);
      refetch();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (storagePath: string) => {
    try {
      const { data, error } = await supabase.storage.from('fms-documents').createSignedUrl(storagePath, 60);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (err) {
      alert("Error opening document. You may lack permission.");
    }
  };

  const handleDelete = async (doc: any) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      const { error: storageErr } = await supabase.storage.from('fms-documents').remove([doc.storage_path]);
      if (storageErr) throw storageErr;
      const { error: dbErr } = await supabase.from('documents').delete().eq('id', doc.id);
      if (dbErr) throw dbErr;
      refetch();
    } catch (err: any) {
      alert("Deletion failed: " + err.message);
    }
  };

  const canDelete = auth.profile?.roles.includes('MIS') || auth.profile?.roles.includes('Admin');

  return (
    <div style={{ background: 'white', border: '1px solid #ccc', padding: '1rem' }}>
      <h3>Document Management</h3>

      <form onSubmit={handleUpload} style={{ display: 'flex', gap: '1rem', 'align-items': 'center', 'margin-bottom': '1rem', background: '#f5f5f5', padding: '1rem' }}>
        <select 
          value={docType()} 
          onChange={(e) => setDocType(e.currentTarget.value)} 
          required 
          disabled={!!props.requiredDocumentType}
        >
          <option value="Gatepass">Gatepass</option>
          <option value="Invoice">Invoice</option>
          <option value="Bilty">Bilty / LR</option>
          <option value="Summary">Summary</option>
          <option value="Purchase Order">Purchase Order</option>
          <option value="Credit Note">Credit Note</option>
          <option value="Other">Other</option>
        </select>
        
        <input 
          type="file" 
          required 
          onChange={(e) => setFile(e.currentTarget.files ? e.currentTarget.files[0] : null)}
          accept=".pdf,.jpg,.jpeg,.png,.webp"
        />

        <button type="submit" disabled={uploading() || !file()}>
          {uploading() ? 'Uploading...' : 'Upload Securely'}
        </button>
      </form>
      
      {errorMsg() && <div style={{ color: 'red', 'margin-bottom': '1rem' }}>{errorMsg()}</div>}

      <table style={{ width: '100%', 'border-collapse': 'collapse', 'text-align': 'left' }}>
        <thead>
          <tr style={{ 'border-bottom': '2px solid #ddd' }}>
            <th>Type</th>
            <th>File Name</th>
            <th>Stage Added</th>
            <th>Version</th>
            <th>Size</th>
            <th>Uploaded By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <For each={documents()}>
            {(doc) => (
              <tr style={{ 'border-bottom': '1px solid #eee' }}>
                <td><strong>{doc.document_type}</strong></td>
                <td>{doc.file_name}</td>
                <td>{doc.order_stages?.workflow_stages?.stage_name || 'N/A'}</td>
                <td>v{doc.version}</td>
                <td>{(doc.file_size / 1024).toFixed(2)} KB</td>
                <td>{doc.profiles?.full_name}</td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleView(doc.storage_path)}>View</button>
                  <Show when={canDelete}>
                    <button style={{ color: 'red' }} onClick={() => handleDelete(doc)}>Delete</button>
                  </Show>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};
