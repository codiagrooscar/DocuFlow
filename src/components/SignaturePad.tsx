import React, { useRef, useEffect, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Button } from './ui/button';
import { Undo2, Check, X } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  existingSignature?: string;
}

export default function SignaturePad({ onSave, onCancel, existingSignature }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 1,
      maxWidth: 2.5,
    });

    pad.addEventListener('endStroke', () => {
      setIsEmpty(pad.isEmpty());
    });

    padRef.current = pad;

    if (existingSignature) {
      pad.fromDataURL(existingSignature);
      setIsEmpty(false);
    }

    return () => {
      pad.off();
    };
  }, [existingSignature]);

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (padRef.current && !padRef.current.isEmpty()) {
      const dataUrl = padRef.current.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height: '200px' }}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center italic">
        Firme en el recuadro con el ratón o dispositivo táctil
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleClear} disabled={isEmpty}>
          <Undo2 className="h-4 w-4 mr-1" /> Borrar
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" /> Cancelar
        </Button>
        <Button 
          size="sm" 
          onClick={handleSave} 
          disabled={isEmpty}
          className="bg-codiagro-green hover:bg-codiagro-green-dark"
        >
          <Check className="h-4 w-4 mr-1" /> Confirmar Firma
        </Button>
      </div>
    </div>
  );
}
