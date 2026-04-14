import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      let isFirestoreError = false;
      let firestoreErrorDetails = null;

      try {
        if (this.state.error?.message && this.state.error.message.includes('FirestoreErrorInfo')) {
           // It might be a JSON string, let's try to parse it
           const parsed = JSON.parse(this.state.error.message);
           if (parsed.operationType) {
             isFirestoreError = true;
             firestoreErrorDetails = parsed;
           }
        } else if (this.state.error?.message && this.state.error.message.startsWith('{')) {
           const parsed = JSON.parse(this.state.error.message);
           if (parsed.operationType) {
             isFirestoreError = true;
             firestoreErrorDetails = parsed;
           }
        }
      } catch (e) {
        // Not a JSON string
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg border border-red-100">
            <div className="flex justify-center mb-6">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="h-10 w-10 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">
              Algo salió mal
            </h1>
            
            {isFirestoreError ? (
              <div className="space-y-4">
                <p className="text-gray-600 text-center">
                  Parece que hay un problema de permisos con la base de datos.
                </p>
                <div className="bg-slate-100 p-4 rounded text-sm font-mono overflow-auto">
                  <p className="font-semibold text-red-600 mb-2">Error de Firestore:</p>
                  <p>Operación: {firestoreErrorDetails?.operationType}</p>
                  <p>Ruta: {firestoreErrorDetails?.path}</p>
                  <p className="mt-2 text-xs text-slate-500 break-words">
                    {firestoreErrorDetails?.error}
                  </p>
                </div>
                <div className="mt-4 p-4 bg-blue-50 text-blue-800 text-sm rounded-md">
                  <p className="font-semibold mb-1">¿Cómo solucionarlo?</p>
                  <p>Ve a tu consola de Firebase &gt; Firestore Database &gt; Rules y asegúrate de que las reglas permitan esta operación.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600 text-center">
                  Ha ocurrido un error inesperado en la aplicación.
                </p>
                <div className="bg-slate-100 p-4 rounded text-sm font-mono overflow-auto max-h-48">
                  {this.state.error?.message || (typeof this.state.error === 'string' ? this.state.error : JSON.stringify(this.state.error)) || 'Error desconocido'}
                </div>
              </div>
            )}
            
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
