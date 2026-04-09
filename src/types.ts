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

export type ProcessStage = 'cotizacion' | 'proforma' | 'pedido' | 'albaran' | 'factura' | 'completado';

export type ProcessTag = 'Urgente' | 'VIP' | 'Exportación' | 'Frío' | 'Muestra';

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
  
  // Cotización States
  quoteStatus: 'draft' | 'pending_sales_auth' | 'pending_compliance_auth' | 'pending_risk_auth' | 'pending_auth' | 'authorized' | 'sent_to_client' | 'client_accepted' | 'rejected';
  authRequests?: AuthRequest[];
  
  // Proforma States
  proformaStatus: 'pending' | 'generated' | 'sent' | 'paid';
  
  // Pedido States
  orderStatus: 'pending' | 'sent_to_production' | 'in_manufacturing' | 'ready_for_pickup' | 'shipped';
  
  // Albarán States
  deliveryStatus: 'pending' | 'generated' | 'signed';
  
  // Factura States
  invoiceStatus: 'pending' | 'generated' | 'sent' | 'paid';

  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface ActivityLog {
  id: string;
  processId: string;
  action: string;
  performedBy: string;
  performedByName: string;
  timestamp: number;
  details?: string;
}
