# SANAVI INTERNATIONAL - Prime X Management System

Sistema de gestión corporativa para el control de Caja Chica e Inventario de Prime X.

## Características

- **Gestión de Caja Chica**: Registro de ingresos y egresos con reportes PDF.
- **Control de Inventario**: Seguimiento de stock de paquetes (Standard, Profesional, Temporada).
- **Reportes Ejecutivos**: Generación de PDFs con firma digital y logo personalizado.
- **Persistencia Real**: Integración completa con Supabase.
- **Interfaz Moderna**: Diseño oscuro con animaciones fluidas y estética "glassmorphism".

## Configuración Local

1. **Clonar el repositorio**:
   ```bash
   git clone <tu-url-de-github>
   cd sanavi-international
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Variables de Entorno**:
   Crea un archivo `.env` en la raíz del proyecto con tus credenciales de Supabase:
   ```env
   VITE_SUPABASE_URL=https://xipkynbqtubfleehagpp.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
   ```

4. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

## Estructura del Proyecto

- `/src/App.tsx`: Componente principal de la aplicación.
- `/src/lib/supabase.ts`: Configuración del cliente de Supabase.
- `/src/index.css`: Estilos globales y configuración de Tailwind CSS.
- `/supabase_setup.sql`: Script SQL para crear las tablas necesarias en Supabase.

## Tecnologías

- **Frontend**: React 19, TypeScript, Vite.
- **Estilos**: Tailwind CSS 4.
- **Iconos**: Lucide React.
- **Animaciones**: Motion.
- **PDFs**: jsPDF, jspdf-autotable.
- **Base de Datos**: Supabase.

---
Desarrollado para **SANAVI INTERNATIONAL** - Giovanni Coto.
