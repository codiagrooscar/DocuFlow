export type Role = 'admin' | 'sales' | 'compliance' | 'risk' | 'production' | 'logistics' | 'finance';

export const roleTranslations: Record<Role, string> = {
  admin: 'Administrador',
  sales: 'Comercial',
  compliance: 'Normativa',
  risk: 'Riesgos',
  production: 'Producción',
  logistics: 'Logística',
  finance: 'Finanzas'
};

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
}

export type ProcessStage = 'oferta' | 'pedido' | 'produccion' | 'logistica' | 'albaran' | 'factura' | 'completado';

export type ProcessTag = 'Urgente' | 'VIP' | 'Exportación' | 'Frío' | 'Muestra';

export type Currency = 'EUR' | 'USD' | 'GBP';

export const currencySymbols: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£'
};

export interface Document {
  id: string;
  name: string;
  url: string;
  stage: ProcessStage;
  uploadedBy: string;
  uploadedAt: number;
  version?: number;
  groupId?: string;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  createdBy: string;
}

export interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  timestamp: number;
}

export interface AuthRequest {
  role: Role;
  status: 'pending' | 'approved' | 'rejected';
}

// Certificado para la fase de Producción (Mejora #1)
export interface Certificate {
  id: string;
  name: string;
  required: boolean;
  uploaded: boolean;
  documentId?: string;
  uploadedAt?: number;
}

// Tipos de certificados estándar para exportación
export const DEFAULT_CERTIFICATES: Omit<Certificate, 'id'>[] = [
  { name: 'Certificado Fitosanitario', required: true, uploaded: false },
  { name: 'Certificado de Análisis', required: true, uploaded: false },
  { name: 'Certificado de Origen', required: false, uploaded: false },
  { name: 'Ficha de Seguridad (SDS)', required: false, uploaded: false },
  { name: 'Certificado de Libre Venta', required: false, uploaded: false },
];

export interface SalesProcess {
  id: string;
  title: string;
  clientName: string;
  currentStage: ProcessStage;
  pdfUrl?: string;
  pdfName?: string;
  documents: Document[];
  comments: Comment[];
  tasks?: Task[];
  tags?: ProcessTag[];
  estimatedDeliveryDate?: number;
  validUntil?: number;
  trackingToken?: string;
  amount: number;
  currency?: Currency; // Multi-moneda (Mejora #7)
  certificates?: Certificate[]; // Certificados de producción (Mejora #1)
  signatureUrl?: string; // Firma digital del albarán (Mejora #9)
  
  // Cotización States
  quoteStatus: 'draft' | 'pending_sales_auth' | 'pending_compliance_auth' | 'pending_risk_auth' | 'pending_auth' | 'authorized' | 'sent_to_client' | 'client_accepted' | 'rejected';
  authRequests?: AuthRequest[];
  
  // Proforma States
  proformaStatus: 'pending' | 'generated' | 'authorized' | 'sent' | 'paid';
  
  // Pedido States
  orderStatus: 'pending' | 'sent_to_production' | 'in_manufacturing' | 'ready_for_pickup' | 'shipped';
  
  // Albarán States
  deliveryStatus: 'pending' | 'generated' | 'signed';
  
  // Factura States
  invoiceStatus: 'pending' | 'generated' | 'sent' | 'paid';

  createdAt: number;
  updatedAt: number;
  createdBy: string;
  createdByName?: string;
}

// Auditoría detallada (Mejora #10)
export interface FieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface ActivityLog {
  id: string;
  processId: string;
  action: string;
  performedBy: string;
  performedByName: string;
  timestamp: number;
  details?: string;
  changes?: FieldChange[];
}
