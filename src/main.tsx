import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import axios from 'axios';
import App from './App.tsx';
import './index.css';

const rawApiBase = import.meta.env.VITE_API_URL as string | undefined;
const normalizedApiBase = rawApiBase ? rawApiBase.replace(/\/+$/, '') : '';
if (normalizedApiBase) {
  axios.defaults.baseURL = normalizedApiBase;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
