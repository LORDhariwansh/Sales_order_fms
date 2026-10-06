# Document Specification

The FMS handles several document types. In the Google Sheets system, these are stored as Google Drive URLs.

## Document Types
1. **Upload Order:** Original order document/PO from the customer.
2. **Gate Pass Upload:** Proof of vehicle leaving premises.
3. **Short & Excess Upload:** Documentation for dispatch weight/quantity variations.
4. **New Invoice Upload:** The finalized tax invoice.
5. **New Summary Upload:** Packing list or summary of dispatched goods.
6. **New Bilty Upload:** LR (Lorry Receipt) or Bilty from the transporter.

## Target Architecture
Instead of Google Forms -> Google Drive URLs, the SolidJS application will use **Supabase Storage**.
- A storage bucket named `fms-documents` will be created.
- Documents will be stored with a path structure like `{order_id}/{document_type}_{timestamp}.pdf`.
- The PostgreSQL `orders` table will store the relative Supabase Storage paths.
