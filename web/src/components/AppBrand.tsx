/*
SUME DOCBLOCK
Nombre: web/src/components/AppBrand.tsx
Tipo: Salida
Entradas: Ninguna
Acciones: Mostrar la identidad visual de Aura
Salidas: Marca accesible de la aplicación
*/
import {Wallet} from 'lucide-react';

export function AppBrand(){
 return <div className="brand"><span className="brand-icon"><Wallet size={22} strokeWidth={2.4}/></span><span className="brand-type"><strong>aura<span>.</span></strong><small>FINANZAS</small></span></div>;
}
