
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ai_conversations": {
                  Row: {
                    "company_id": string,"created_at": string,"id": string,"title": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"id"?: string,"title"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"id"?: string,"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_conversations_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_conversations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_messages": {
                  Row: {
                    "company_id": string,"content": string,"conversation_id": string,"created_at": string,"id": number,"role": string,"tokens_in": number | null,"tokens_out": number | null,"tool_calls": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"content": string,"conversation_id": string,"created_at"?: string,"id"?: never,"role": string,"tokens_in"?: number | null,"tokens_out"?: number | null,"tool_calls"?: Json | null
                  }
                  Update: {
                    "company_id"?: string,"content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: never,"role"?: string,"tokens_in"?: number | null,"tokens_out"?: number | null,"tool_calls"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_messages_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "ai_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"at": string,"company_id": string | null,"id": number,"ip": unknown,"new_data": Json | null,"old_data": Json | null,"reason": string | null,"row_id": string | null,"table_name": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"at"?: string,"company_id"?: string | null,"id"?: never,"ip"?: unknown,"new_data"?: Json | null,"old_data"?: Json | null,"reason"?: string | null,"row_id"?: string | null,"table_name": string,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"at"?: string,"company_id"?: string | null,"id"?: never,"ip"?: unknown,"new_data"?: Json | null,"old_data"?: Json | null,"reason"?: string | null,"row_id"?: string | null,"table_name"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"bank_transactions": {
                  Row: {
                    "amount": number,"bank_account": string,"company_id": string,"counterparty": string | null,"created_at": string,"currency": string,"date": string,"description": string | null,"hash": string | null,"id": string,"import_batch_id": string | null,"matched_invoice_id": string | null,"reference": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"bank_account": string,"company_id": string,"counterparty"?: string | null,"created_at"?: string,"currency"?: string,"date": string,"description"?: string | null,"hash"?: string | null,"id"?: string,"import_batch_id"?: string | null,"matched_invoice_id"?: string | null,"reference"?: string | null
                  }
                  Update: {
                    "amount"?: number,"bank_account"?: string,"company_id"?: string,"counterparty"?: string | null,"created_at"?: string,"currency"?: string,"date"?: string,"description"?: string | null,"hash"?: string | null,"id"?: string,"import_batch_id"?: string | null,"matched_invoice_id"?: string | null,"reference"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_transactions_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_transactions_import_batch_id_fkey"
      columns: ["import_batch_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_transactions_matched_invoice_id_fkey"
      columns: ["matched_invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "activity": string | null,"address": string | null,"administrator_name": string | null,"base_currency": string,"city": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"email": string | null,"fiscal_year_start": number,"id": string,"legal_form": Database["public"]['Enums']["legal_form"],"legal_name": string,"nace_code": string | null,"nipt": string,"organization_id": string,"phone": string | null,"settings": NonNullable<Json>,"status": string,"tax_regime": Database["public"]['Enums']["tax_regime"],"trade_name": string | null,"updated_at": string,"vat_registered": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "activity"?: string | null,"address"?: string | null,"administrator_name"?: string | null,"base_currency"?: string,"city"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"fiscal_year_start"?: number,"id"?: string,"legal_form"?: Database["public"]['Enums']["legal_form"],"legal_name": string,"nace_code"?: string | null,"nipt": string,"organization_id": string,"phone"?: string | null,"settings"?: NonNullable<Json>,"status"?: string,"tax_regime"?: Database["public"]['Enums']["tax_regime"],"trade_name"?: string | null,"updated_at"?: string,"vat_registered"?: boolean
                  }
                  Update: {
                    "activity"?: string | null,"address"?: string | null,"administrator_name"?: string | null,"base_currency"?: string,"city"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"fiscal_year_start"?: number,"id"?: string,"legal_form"?: Database["public"]['Enums']["legal_form"],"legal_name"?: string,"nace_code"?: string | null,"nipt"?: string,"organization_id"?: string,"phone"?: string | null,"settings"?: NonNullable<Json>,"status"?: string,"tax_regime"?: Database["public"]['Enums']["tax_regime"],"trade_name"?: string | null,"updated_at"?: string,"vat_registered"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "companies_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"company_memberships": {
                  Row: {
                    "company_id": string,"created_at": string,"role": Database["public"]['Enums']["company_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"role": Database["public"]['Enums']["company_role"],"user_id": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"role"?: Database["public"]['Enums']["company_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_memberships_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "address": string | null,"company_id": string,"country": string,"created_at": string,"deleted_at": string | null,"email": string | null,"id": string,"is_vat_payer": boolean,"name": string,"nipt": string | null,"notes": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"company_id": string,"country"?: string,"created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"is_vat_payer"?: boolean,"name": string,"nipt"?: string | null,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"company_id"?: string,"country"?: string,"created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"is_vat_payer"?: boolean,"name"?: string,"nipt"?: string | null,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "category": Database["public"]['Enums']["document_category"],"company_id": string,"created_at": string,"deleted_at": string | null,"description": string | null,"document_date": string | null,"file_name": string,"id": string,"linked_id": string | null,"linked_type": string | null,"mime": string,"ocr_status": Database["public"]['Enums']["ocr_status"],"ocr_text": string | null,"previous_version_id": string | null,"sha256": string | null,"size_bytes": number,"storage_path": string,"tags": (string)[],"title": string | null,"updated_at": string,"uploaded_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: Database["public"]['Enums']["document_category"],"company_id": string,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"document_date"?: string | null,"file_name": string,"id"?: string,"linked_id"?: string | null,"linked_type"?: string | null,"mime": string,"ocr_status"?: Database["public"]['Enums']["ocr_status"],"ocr_text"?: string | null,"previous_version_id"?: string | null,"sha256"?: string | null,"size_bytes": number,"storage_path": string,"tags"?: (string)[],"title"?: string | null,"updated_at"?: string,"uploaded_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["document_category"],"company_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"document_date"?: string | null,"file_name"?: string,"id"?: string,"linked_id"?: string | null,"linked_type"?: string | null,"mime"?: string,"ocr_status"?: Database["public"]['Enums']["ocr_status"],"ocr_text"?: string | null,"previous_version_id"?: string | null,"sha256"?: string | null,"size_bytes"?: number,"storage_path"?: string,"tags"?: (string)[],"title"?: string | null,"updated_at"?: string,"uploaded_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_previous_version_id_fkey"
      columns: ["previous_version_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"fiscal_periods": {
                  Row: {
                    "closed_at": string | null,"closed_by": string | null,"company_id": string,"created_at": string,"id": string,"month": number,"reopen_reason": string | null,"reopened_at": string | null,"reopened_by": string | null,"status": Database["public"]['Enums']["period_status"],"updated_at": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"company_id": string,"created_at"?: string,"id"?: string,"month": number,"reopen_reason"?: string | null,"reopened_at"?: string | null,"reopened_by"?: string | null,"status"?: Database["public"]['Enums']["period_status"],"updated_at"?: string,"year": number
                  }
                  Update: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"company_id"?: string,"created_at"?: string,"id"?: string,"month"?: number,"reopen_reason"?: string | null,"reopened_at"?: string | null,"reopened_by"?: string | null,"status"?: Database["public"]['Enums']["period_status"],"updated_at"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fiscal_periods_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fiscal_periods_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fiscal_periods_reopened_by_fkey"
      columns: ["reopened_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"import_batches": {
                  Row: {
                    "company_id": string,"created_at": string,"created_by": string | null,"direction": Database["public"]['Enums']["invoice_direction"] | null,"errors": NonNullable<Json>,"file_document_id": string | null,"file_name": string | null,"finished_at": string | null,"format": Database["public"]['Enums']["import_format"],"id": string,"reverted_at": string | null,"rows_duplicate": number,"rows_error": number,"rows_imported": number,"rows_total": number,"status": Database["public"]['Enums']["import_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"created_by"?: string | null,"direction"?: Database["public"]['Enums']["invoice_direction"] | null,"errors"?: NonNullable<Json>,"file_document_id"?: string | null,"file_name"?: string | null,"finished_at"?: string | null,"format": Database["public"]['Enums']["import_format"],"id"?: string,"reverted_at"?: string | null,"rows_duplicate"?: number,"rows_error"?: number,"rows_imported"?: number,"rows_total"?: number,"status"?: Database["public"]['Enums']["import_status"]
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"created_by"?: string | null,"direction"?: Database["public"]['Enums']["invoice_direction"] | null,"errors"?: NonNullable<Json>,"file_document_id"?: string | null,"file_name"?: string | null,"finished_at"?: string | null,"format"?: Database["public"]['Enums']["import_format"],"id"?: string,"reverted_at"?: string | null,"rows_duplicate"?: number,"rows_error"?: number,"rows_imported"?: number,"rows_total"?: number,"status"?: Database["public"]['Enums']["import_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_batches_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "import_batches_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "import_batches_file_fk"
      columns: ["file_document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"import_rows": {
                  Row: {
                    "batch_id": string,"company_id": string,"error": string | null,"id": number,"invoice_id": string | null,"normalized": Json | null,"raw": NonNullable<Json>,"row_no": number,"status": Database["public"]['Enums']["import_row_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"company_id": string,"error"?: string | null,"id"?: never,"invoice_id"?: string | null,"normalized"?: Json | null,"raw": NonNullable<Json>,"row_no": number,"status"?: Database["public"]['Enums']["import_row_status"]
                  }
                  Update: {
                    "batch_id"?: string,"company_id"?: string,"error"?: string | null,"id"?: never,"invoice_id"?: string | null,"normalized"?: Json | null,"raw"?: NonNullable<Json>,"row_no"?: number,"status"?: Database["public"]['Enums']["import_row_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_rows_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "import_rows_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"integrations": {
                  Row: {
                    "company_id": string,"config": NonNullable<Json>,"created_at": string,"credentials_vault_id": string | null,"id": string,"last_error": string | null,"last_sync_at": string | null,"provider": Database["public"]['Enums']["integration_provider"],"status": Database["public"]['Enums']["integration_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"config"?: NonNullable<Json>,"created_at"?: string,"credentials_vault_id"?: string | null,"id"?: string,"last_error"?: string | null,"last_sync_at"?: string | null,"provider": Database["public"]['Enums']["integration_provider"],"status"?: Database["public"]['Enums']["integration_status"],"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"config"?: NonNullable<Json>,"created_at"?: string,"credentials_vault_id"?: string | null,"id"?: string,"last_error"?: string | null,"last_sync_at"?: string | null,"provider"?: Database["public"]['Enums']["integration_provider"],"status"?: Database["public"]['Enums']["integration_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integrations_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"company_id": string | null,"company_role": Database["public"]['Enums']["company_role"] | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"org_role": Database["public"]['Enums']["org_role"] | null,"organization_id": string | null,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"company_id"?: string | null,"company_role"?: Database["public"]['Enums']["company_role"] | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"org_role"?: Database["public"]['Enums']["org_role"] | null,"organization_id"?: string | null,"token"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"company_id"?: string | null,"company_role"?: Database["public"]['Enums']["company_role"] | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"org_role"?: Database["public"]['Enums']["org_role"] | null,"organization_id"?: string | null,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_documents": {
                  Row: {
                    "company_id": string,"document_id": string,"invoice_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"document_id": string,"invoice_id": string
                  }
                  Update: {
                    "company_id"?: string,"document_id"?: string,"invoice_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_documents_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_documents_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_documents_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_items": {
                  Row: {
                    "company_id": string,"description": string,"id": string,"invoice_id": string,"line_no": number,"line_total": number,"qty": number,"unit": string | null,"unit_price": number,"vat_amount": number,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"description"?: string,"id"?: string,"invoice_id": string,"line_no": number,"line_total"?: number,"qty"?: number,"unit"?: string | null,"unit_price"?: number,"vat_amount"?: number,"vat_rate"?: number
                  }
                  Update: {
                    "company_id"?: string,"description"?: string,"id"?: string,"invoice_id"?: string,"line_no"?: number,"line_total"?: number,"qty"?: number,"unit"?: string | null,"unit_price"?: number,"vat_amount"?: number,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_items_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "company_id": string,"corrects_invoice_id": string | null,"counterparty_name": string | null,"counterparty_nipt": string | null,"created_at": string,"created_by": string | null,"currency": string,"customer_id": string | null,"deleted_at": string | null,"direction": Database["public"]['Enums']["invoice_direction"],"due_date": string | null,"exchange_rate": number,"id": string,"import_batch_id": string | null,"issue_date": string,"nivf": string | null,"notes": string | null,"nslf": string | null,"number": string | null,"paid_amount": number,"paid_at": string | null,"payment_method": Database["public"]['Enums']["payment_method"],"payment_status": Database["public"]['Enums']["payment_status"],"period_id": string | null,"raw": Json | null,"source": Database["public"]['Enums']["invoice_source"],"subtotal": number,"supplier_id": string | null,"total": number,"type": Database["public"]['Enums']["invoice_type"],"updated_at": string,"vat_amount": number,"vat_breakdown": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"corrects_invoice_id"?: string | null,"counterparty_name"?: string | null,"counterparty_nipt"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"customer_id"?: string | null,"deleted_at"?: string | null,"direction": Database["public"]['Enums']["invoice_direction"],"due_date"?: string | null,"exchange_rate"?: number,"id"?: string,"import_batch_id"?: string | null,"issue_date": string,"nivf"?: string | null,"notes"?: string | null,"nslf"?: string | null,"number"?: string | null,"paid_amount"?: number,"paid_at"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"payment_status"?: Database["public"]['Enums']["payment_status"],"period_id"?: string | null,"raw"?: Json | null,"source"?: Database["public"]['Enums']["invoice_source"],"subtotal"?: number,"supplier_id"?: string | null,"total"?: number,"type"?: Database["public"]['Enums']["invoice_type"],"updated_at"?: string,"vat_amount"?: number,"vat_breakdown"?: NonNullable<Json>
                  }
                  Update: {
                    "company_id"?: string,"corrects_invoice_id"?: string | null,"counterparty_name"?: string | null,"counterparty_nipt"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"customer_id"?: string | null,"deleted_at"?: string | null,"direction"?: Database["public"]['Enums']["invoice_direction"],"due_date"?: string | null,"exchange_rate"?: number,"id"?: string,"import_batch_id"?: string | null,"issue_date"?: string,"nivf"?: string | null,"notes"?: string | null,"nslf"?: string | null,"number"?: string | null,"paid_amount"?: number,"paid_at"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"payment_status"?: Database["public"]['Enums']["payment_status"],"period_id"?: string | null,"raw"?: Json | null,"source"?: Database["public"]['Enums']["invoice_source"],"subtotal"?: number,"supplier_id"?: string | null,"total"?: number,"type"?: Database["public"]['Enums']["invoice_type"],"updated_at"?: string,"vat_amount"?: number,"vat_breakdown"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_corrects_invoice_id_fkey"
      columns: ["corrects_invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_import_batch_id_fkey"
      columns: ["import_batch_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_period_id_fkey"
      columns: ["period_id"]
isOneToOne: false
      referencedRelation: "fiscal_periods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"company_id": string | null,"created_at": string,"id": string,"kind": string,"link": string | null,"read_at": string | null,"sent_email_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"company_id"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"link"?: string | null,"read_at"?: string | null,"sent_email_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"company_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"sent_email_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_memberships": {
                  Row: {
                    "created_at": string,"organization_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"organization_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"name": string,"settings": NonNullable<Json>,"subscription_id": string | null,"type": Database["public"]['Enums']["organization_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"name": string,"settings"?: NonNullable<Json>,"subscription_id"?: string | null,"type"?: Database["public"]['Enums']["organization_type"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"name"?: string,"settings"?: NonNullable<Json>,"subscription_id"?: string | null,"type"?: Database["public"]['Enums']["organization_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "action": string,"allowed": boolean,"module": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"allowed"?: boolean,"module": string,"role": string
                  }
                  Update: {
                    "action"?: string,"allowed"?: boolean,"module"?: string,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plans": {
                  Row: {
                    "currency": string,"id": string,"is_active": boolean,"limits": NonNullable<Json>,"name": string,"price_month": number,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "currency"?: string,"id": string,"is_active"?: boolean,"limits"?: NonNullable<Json>,"name": string,"price_month"?: number,"sort_order"?: number
                  }
                  Update: {
                    "currency"?: string,"id"?: string,"is_active"?: boolean,"limits"?: NonNullable<Json>,"name"?: string,"price_month"?: number,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "created_at": string,"id": string,"organization_id": string,"payment_provider": string | null,"payment_provider_ref": string | null,"period_end": string | null,"period_start": string,"plan_id": string,"status": Database["public"]['Enums']["subscription_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"organization_id": string,"payment_provider"?: string | null,"payment_provider_ref"?: string | null,"period_end"?: string | null,"period_start"?: string,"plan_id": string,"status"?: Database["public"]['Enums']["subscription_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"organization_id"?: string,"payment_provider"?: string | null,"payment_provider_ref"?: string | null,"period_end"?: string | null,"period_start"?: string,"plan_id"?: string,"status"?: Database["public"]['Enums']["subscription_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "address": string | null,"company_id": string,"country": string,"created_at": string,"deleted_at": string | null,"email": string | null,"id": string,"is_foreign": boolean,"name": string,"nipt": string | null,"notes": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"company_id": string,"country"?: string,"created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"is_foreign"?: boolean,"name": string,"nipt"?: string | null,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"company_id"?: string,"country"?: string,"created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"is_foreign"?: boolean,"name"?: string,"nipt"?: string | null,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"sync_jobs": {
                  Row: {
                    "attempts": number,"company_id": string,"created_at": string,"created_by": string | null,"error": string | null,"finished_at": string | null,"id": string,"integration_id": string | null,"kind": string,"payload": NonNullable<Json>,"result": Json | null,"run_after": string,"started_at": string | null,"status": Database["public"]['Enums']["job_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"company_id": string,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"integration_id"?: string | null,"kind": string,"payload"?: NonNullable<Json>,"result"?: Json | null,"run_after"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["job_status"]
                  }
                  Update: {
                    "attempts"?: number,"company_id"?: string,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"integration_id"?: string | null,"kind"?: string,"payload"?: NonNullable<Json>,"result"?: Json | null,"run_after"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["job_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "sync_jobs_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sync_jobs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sync_jobs_integration_id_fkey"
      columns: ["integration_id"]
isOneToOne: false
      referencedRelation: "integrations"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assigned_to": string | null,"company_id": string,"completed_at": string | null,"created_at": string,"created_by": string | null,"declaration_id": string | null,"description": string | null,"due_date": string | null,"id": string,"kind": string,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"company_id": string,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"declaration_id"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"kind"?: string,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"company_id"?: string,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"declaration_id"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"kind"?: string,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_declaration_id_fkey"
      columns: ["declaration_id"]
isOneToOne: false
      referencedRelation: "tax_declarations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_declaration_id_fkey"
      columns: ["declaration_id"]
isOneToOne: false
      referencedRelation: "tax_declarations_view"
      referencedColumns: ["id"]
    }
                  ]
                },"tax_calendar_items": {
                  Row: {
                    "applies_to": NonNullable<Json>,"company_id": string | null,"created_at": string,"created_by": string | null,"due_date": string,"id": string,"kind": Database["public"]['Enums']["declaration_kind"],"recurrence": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applies_to"?: NonNullable<Json>,"company_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_date": string,"id"?: string,"kind": Database["public"]['Enums']["declaration_kind"],"recurrence"?: string | null,"title": string
                  }
                  Update: {
                    "applies_to"?: NonNullable<Json>,"company_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_date"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["declaration_kind"],"recurrence"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tax_calendar_items_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_calendar_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"tax_declarations": {
                  Row: {
                    "assigned_to": string | null,"company_id": string,"computed": NonNullable<Json>,"created_at": string,"declared_at": string | null,"declared_by": string | null,"due_date": string,"id": string,"kind": Database["public"]['Enums']["declaration_kind"],"notes": string | null,"official": NonNullable<Json>,"period_id": string,"source_document_id": string | null,"status": Database["public"]['Enums']["declaration_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"company_id": string,"computed"?: NonNullable<Json>,"created_at"?: string,"declared_at"?: string | null,"declared_by"?: string | null,"due_date": string,"id"?: string,"kind": Database["public"]['Enums']["declaration_kind"],"notes"?: string | null,"official"?: NonNullable<Json>,"period_id": string,"source_document_id"?: string | null,"status"?: Database["public"]['Enums']["declaration_status"],"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"company_id"?: string,"computed"?: NonNullable<Json>,"created_at"?: string,"declared_at"?: string | null,"declared_by"?: string | null,"due_date"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["declaration_kind"],"notes"?: string | null,"official"?: NonNullable<Json>,"period_id"?: string,"source_document_id"?: string | null,"status"?: Database["public"]['Enums']["declaration_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tax_decl_source_doc_fk"
      columns: ["source_document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_declarations_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_declarations_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_declarations_declared_by_fkey"
      columns: ["declared_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_declarations_period_id_fkey"
      columns: ["period_id"]
isOneToOne: false
      referencedRelation: "fiscal_periods"
      referencedColumns: ["id"]
    }
                  ]
                },"tax_obligations": {
                  Row: {
                    "amount": number,"company_id": string,"confirmed_official": boolean,"created_at": string,"currency": string,"declaration_id": string | null,"description": string | null,"due_date": string,"id": string,"kind": Database["public"]['Enums']["obligation_kind"],"paid_amount": number,"paid_at": string | null,"payment_order_document_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"company_id": string,"confirmed_official"?: boolean,"created_at"?: string,"currency"?: string,"declaration_id"?: string | null,"description"?: string | null,"due_date": string,"id"?: string,"kind": Database["public"]['Enums']["obligation_kind"],"paid_amount"?: number,"paid_at"?: string | null,"payment_order_document_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"company_id"?: string,"confirmed_official"?: boolean,"created_at"?: string,"currency"?: string,"declaration_id"?: string | null,"description"?: string | null,"due_date"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["obligation_kind"],"paid_amount"?: number,"paid_at"?: string | null,"payment_order_document_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tax_oblig_payment_doc_fk"
      columns: ["payment_order_document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_obligations_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_obligations_declaration_id_fkey"
      columns: ["declaration_id"]
isOneToOne: false
      referencedRelation: "tax_declarations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_obligations_declaration_id_fkey"
      columns: ["declaration_id"]
isOneToOne: false
      referencedRelation: "tax_declarations_view"
      referencedColumns: ["id"]
    }
                  ]
                },"tax_rules": {
                  Row: {
                    "code": string,"company_id": string | null,"confirmed": boolean,"created_at": string,"created_by": string | null,"id": string,"kind": Database["public"]['Enums']["tax_rule_kind"],"params": NonNullable<Json>,"scope": string,"source": string | null,"valid_from": string,"valid_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string,"company_id"?: string | null,"confirmed"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["tax_rule_kind"],"params": NonNullable<Json>,"scope"?: string,"source"?: string | null,"valid_from": string,"valid_to"?: string | null
                  }
                  Update: {
                    "code"?: string,"company_id"?: string | null,"confirmed"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["tax_rule_kind"],"params"?: NonNullable<Json>,"scope"?: string,"source"?: string | null,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tax_rules_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"is_super_admin": boolean,"last_company_id": string | null,"locale": string,"mfa_enabled": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string,"id": string,"is_super_admin"?: boolean,"last_company_id"?: string | null,"locale"?: string,"mfa_enabled"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_super_admin"?: boolean,"last_company_id"?: string | null,"locale"?: string,"mfa_enabled"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "users_last_company_fk"
      columns: ["last_company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "tax_declarations_view": {
                  Row: {
                    "assigned_to": string | null,"company_id": string | null,"computed": Json | null,"created_at": string | null,"declared_at": string | null,"declared_by": string | null,"due_date": string | null,"effective_status": Database["public"]['Enums']["declaration_status"] | null,"id": string | null,"kind": Database["public"]['Enums']["declaration_kind"] | null,"month": number | null,"notes": string | null,"official": Json | null,"period_id": string | null,"source_document_id": string | null,"status": Database["public"]['Enums']["declaration_status"] | null,"updated_at": string | null,"year": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "tax_decl_source_doc_fk"
      columns: ["source_document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_declarations_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_declarations_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_declarations_declared_by_fkey"
      columns: ["declared_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tax_declarations_period_id_fkey"
      columns: ["period_id"]
isOneToOne: false
      referencedRelation: "fiscal_periods"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "close_period":
{ Args: { "p_period_id": string }; Returns: undefined
                           },
"company_turnover":
{ Args: { "p_company_id": string,"p_from": string,"p_to": string }; Returns: {
              "gross_margin": number,"period_from": string,"period_to": string,"purchases_count": number,"purchases_net": number,"purchases_total": number,"purchases_vat": number,"sales_count": number,"sales_net": number,"sales_total": number,"sales_vat": number,"source": string,"vat_balance": number
            }[]
                           },
"create_organization_with_company":
{ Args: { "p_company": Json,"p_org_name": string,"p_org_type": Database["public"]['Enums']["organization_type"] }; Returns: string
                           },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"effective_tax_rule":
{ Args: { "p_code"?: string,"p_company_id"?: string,"p_date": string,"p_kind": Database["public"]['Enums']["tax_rule_kind"] }; Returns: Json
                           },
"ensure_declarations":
{ Args: { "p_company_id": string,"p_month": number,"p_year": number }; Returns: {
              "assigned_to": string | null,
"company_id": string,
"computed": NonNullable<Json>,
"created_at": string,
"declared_at": string | null,
"declared_by": string | null,
"due_date": string,
"id": string,
"kind": Database["public"]['Enums']["declaration_kind"],
"notes": string | null,
"official": NonNullable<Json>,
"period_id": string,
"source_document_id": string | null,
"status": Database["public"]['Enums']["declaration_status"],
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "tax_declarations"
        isOneToOne: false
        isSetofReturn: true
      } },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"log_audit_event":
{ Args: { "p_action": string,"p_company_id": string,"p_reason"?: string,"p_row_id": string,"p_table": string }; Returns: undefined
                           },
"monthly_series":
{ Args: { "p_company_id": string,"p_months"?: number }; Returns: {
              "month": string,"purchases_net": number,"purchases_vat": number,"sales_net": number,"sales_vat": number
            }[]
                           },
"my_company_role":
{ Args: { "p_company_id": string }; Returns: string
                           },
"my_permissions":
{ Args: { "p_company_id": string }; Returns: {
              "action": string,"module": string
            }[]
                           },
"outstanding_obligations":
{ Args: { "p_company_id": string }; Returns: {
              "amount_due": number,"confirmed_official": boolean,"items": number,"kind": Database["public"]['Enums']["obligation_kind"],"next_due_date": string
            }[]
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"reopen_period":
{ Args: { "p_period_id": string,"p_reason": string }; Returns: undefined
                           },
"set_declaration_status":
{ Args: { "p_id": string,"p_notes"?: string,"p_status": Database["public"]['Enums']["declaration_status"] }; Returns: {
              "assigned_to": string | null,
"company_id": string,
"computed": NonNullable<Json>,
"created_at": string,
"declared_at": string | null,
"declared_by": string | null,
"due_date": string,
"id": string,
"kind": Database["public"]['Enums']["declaration_kind"],
"notes": string | null,
"official": NonNullable<Json>,
"period_id": string,
"source_document_id": string | null,
"status": Database["public"]['Enums']["declaration_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "tax_declarations"
        isOneToOne: true
        isSetofReturn: false
      } },
"studio_declaration_matrix":
{ Args: { "p_month": number,"p_year": number }; Returns: {
              "assigned_to": string,"company_id": string,"company_name": string,"declaration_id": string,"declared_at": string,"due_date": string,"effective_status": Database["public"]['Enums']["declaration_status"],"kind": Database["public"]['Enums']["declaration_kind"],"nipt": string,"status": Database["public"]['Enums']["declaration_status"],"vat_registered": boolean
            }[]
                           },
"top_creditors":
{ Args: { "p_company_id": string,"p_limit"?: number }; Returns: {
              "invoices": number,"oldest_due": string,"outstanding": number,"supplier_id": string,"supplier_name": string
            }[]
                           },
"top_debtors":
{ Args: { "p_company_id": string,"p_limit"?: number }; Returns: {
              "customer_id": string,"customer_name": string,"invoices": number,"oldest_due": string,"outstanding": number
            }[]
                           },
"upcoming_deadlines":
{ Args: { "p_company_id": string,"p_days"?: number }; Returns: {
              "days_left": number,"due_date": string,"kind": Database["public"]['Enums']["declaration_kind"],"source": string,"status": string,"title": string
            }[]
                           },
"vat_rates_at":
{ Args: { "p_company_id"?: string,"p_date": string }; Returns: {
              "code": string,"label": string,"rate": number
            }[]
                           },
"vat_summary":
{ Args: { "p_company_id": string,"p_period_id": string }; Returns: {
              "base_amount": number,"direction": Database["public"]['Enums']["invoice_direction"],"invoice_count": number,"vat_amount": number,"vat_rate": number
            }[]
                           }
          }
          Enums: {
            "company_role": "accountant"|"company_admin"|"finance_manager"|"operator"|"viewer","declaration_kind": "vat"|"payroll_esig25"|"withholding"|"profit_tax"|"simplified"|"annual_financial"|"other","declaration_status": "pending"|"in_process"|"for_review"|"suspended"|"declared"|"late","document_category": "invoice"|"contract"|"bank"|"declaration"|"customs"|"employee"|"business"|"report"|"other","import_format": "xlsx"|"csv"|"xml"|"pdf"|"json","import_row_status": "new"|"duplicate"|"error"|"imported"|"skipped","import_status": "queued"|"parsing"|"preview"|"importing"|"done"|"failed"|"reverted","integration_provider": "manual_import"|"selfcare"|"cats"|"bank","integration_status": "functional"|"demo"|"pending_integration"|"unavailable","invoice_direction": "sale"|"purchase","invoice_source": "manual"|"import"|"connector","invoice_type": "normal"|"corrective"|"cancelled"|"summary","job_status": "queued"|"running"|"done"|"failed","legal_form": "pf"|"shpk"|"sha"|"ojf"|"tjeter","obligation_kind": "vat"|"profit_tax"|"simplified_tax"|"withholding"|"social"|"health"|"income_tax"|"local_tax"|"penalty"|"other","ocr_status": "none"|"queued"|"done"|"failed","org_role": "org_owner"|"accountant","organization_type": "studio"|"single"|"demo","payment_method": "cash"|"bank"|"card"|"compensation"|"other"|"unknown","payment_status": "unpaid"|"partial"|"paid"|"void","period_status": "open"|"closing"|"closed","subscription_status": "trialing"|"active"|"past_due"|"cancelled"|"unpaid","task_status": "open"|"in_progress"|"blocked"|"done"|"cancelled","tax_regime": "standard"|"simplified"|"exempt","tax_rule_kind": "vat_rate"|"vat_exempt"|"profit_tax"|"simplified_tax"|"withholding"|"social_contrib"|"health_contrib"|"min_wage"|"max_wage"|"payroll_tax_bracket"|"dividend_tax"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "company_role": ["accountant", "company_admin", "finance_manager", "operator", "viewer"],"declaration_kind": ["vat", "payroll_esig25", "withholding", "profit_tax", "simplified", "annual_financial", "other"],"declaration_status": ["pending", "in_process", "for_review", "suspended", "declared", "late"],"document_category": ["invoice", "contract", "bank", "declaration", "customs", "employee", "business", "report", "other"],"import_format": ["xlsx", "csv", "xml", "pdf", "json"],"import_row_status": ["new", "duplicate", "error", "imported", "skipped"],"import_status": ["queued", "parsing", "preview", "importing", "done", "failed", "reverted"],"integration_provider": ["manual_import", "selfcare", "cats", "bank"],"integration_status": ["functional", "demo", "pending_integration", "unavailable"],"invoice_direction": ["sale", "purchase"],"invoice_source": ["manual", "import", "connector"],"invoice_type": ["normal", "corrective", "cancelled", "summary"],"job_status": ["queued", "running", "done", "failed"],"legal_form": ["pf", "shpk", "sha", "ojf", "tjeter"],"obligation_kind": ["vat", "profit_tax", "simplified_tax", "withholding", "social", "health", "income_tax", "local_tax", "penalty", "other"],"ocr_status": ["none", "queued", "done", "failed"],"org_role": ["org_owner", "accountant"],"organization_type": ["studio", "single", "demo"],"payment_method": ["cash", "bank", "card", "compensation", "other", "unknown"],"payment_status": ["unpaid", "partial", "paid", "void"],"period_status": ["open", "closing", "closed"],"subscription_status": ["trialing", "active", "past_due", "cancelled", "unpaid"],"task_status": ["open", "in_progress", "blocked", "done", "cancelled"],"tax_regime": ["standard", "simplified", "exempt"],"tax_rule_kind": ["vat_rate", "vat_exempt", "profit_tax", "simplified_tax", "withholding", "social_contrib", "health_contrib", "min_wage", "max_wage", "payroll_tax_bracket", "dividend_tax"]
          }
        }
} as const
