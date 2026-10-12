/*
SUME DOCBLOCK
Nombre: web/src/main.tsx
Tipo: Entrada
Entradas: Elemento raíz HTML
Acciones: Montar Aura Finanzas en React
Salidas: Árbol de aplicación
*/
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
