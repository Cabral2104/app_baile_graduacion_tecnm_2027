import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { GalaDialogProvider } from './components/GalaConfirmModal';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <GalaDialogProvider>
      <App />
    </GalaDialogProvider>
  </React.StrictMode>
);

