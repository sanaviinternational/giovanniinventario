/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Minus, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Package, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShoppingCart,
  Gift,
  LayoutDashboard,
  Trash2,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from './lib/supabase';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type TransactionType = 'ingreso' | 'egreso';

interface Transaction {
  id: string;
  date: string;
  detail: string;
  amount: number;
  type: TransactionType;
}

type InventoryType = 'entrada' | 'salida';
type ExitReason = 'venta' | 'regalia';

interface InventoryEntry {
  id: string;
  date: string;
  product: string;
  quantity: number;
  type: InventoryType;
  reason?: ExitReason;
  orderNumber?: string;
  detail?: string;
}

// --- Components ---

const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("glass rounded-3xl p-6", className)}>
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, trend, color }: { 
  title: string; 
  value: string | number; 
  icon: any; 
  trend?: string;
  color?: string;
}) => (
  <GlassCard className="flex flex-col gap-2 relative overflow-hidden group">
    <div className={cn("absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 blur-2xl", color ? `bg-${color}` : "bg-prime")} />
    <div className="flex justify-between items-start">
      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
        <Icon size={20} className={color ? `text-${color}` : "text-prime"} />
      </div>
      {trend && (
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{trend}</span>
      )}
    </div>
    <div className="mt-2">
      <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest">{title}</p>
      <h3 className="text-2xl font-display font-bold mt-1 tracking-tight">{value}</h3>
    </div>
  </GlassCard>
);

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="glass w-full max-w-md rounded-3xl overflow-hidden relative z-10"
        >
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-xl font-display font-bold text-gradient">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <Plus className="rotate-45" size={20} />
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const Input = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5">
    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">{label}</label>
    <input 
      {...props} 
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-prime/50 focus:ring-1 focus:ring-prime/20 transition-all"
    />
  </div>
);

const Select = ({ label, options, ...props }: { label: string, options: { value: string, label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="space-y-1.5">
    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">{label}</label>
    <select 
      {...props} 
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-prime/50 transition-all appearance-none"
    >
      {options.map(opt => <option key={opt.value} value={opt.value} className="bg-zinc-900">{opt.label}</option>)}
    </select>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'caja' | 'inventario'>('caja');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCajaModalOpen, setIsCajaModalOpen] = useState(false);
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'caja' | 'inventario' } | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoDims, setLogoDims] = useState<{ w: number, h: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  
  // Form States
  const [cajaForm, setCajaForm] = useState({ detail: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), type: 'ingreso' as TransactionType });
  const [invForm, setInvForm] = useState({ product: 'Paquete Standard', quantity: '', date: format(new Date(), 'yyyy-MM-dd'), type: 'entrada' as InventoryType, reason: 'venta' as ExitReason, orderNumber: '', detail: '' });

  // State for Caja Chica
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // State for Inventario
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);

  // Fetch Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });
      
      if (transError) throw transError;
      setTransactions(transData || []);

      const { data: invData, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .order('date', { ascending: false });
      
      if (invError) throw invError;
      setInventory(invData || []);

      // Fetch Logo
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'global')
        .single();
      
      if (!settingsError && settingsData) {
        setLogo(settingsData.logo_url);
        setLogoDims(settingsData.logo_dims);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error al cargar los datos de Supabase');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleAddCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    const newTransaction = {
      detail: cajaForm.detail,
      amount: parseFloat(cajaForm.amount),
      date: cajaForm.date,
      type: cajaForm.type
    };

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([newTransaction])
        .select();
      
      if (error) throw error;
      if (data) {
        setTransactions([data[0], ...transactions]);
      }
      setIsCajaModalOpen(false);
      setCajaForm({ detail: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), type: 'ingreso' });
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Error al guardar en Supabase');
    }
  };

  const handleAddInv = async (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry = {
      product: invForm.product,
      quantity: parseInt(invForm.quantity),
      date: invForm.date,
      type: invForm.type,
      reason: invForm.type === 'salida' ? invForm.reason : null,
      order_number: invForm.type === 'salida' && invForm.reason === 'venta' ? invForm.orderNumber : null,
      detail: invForm.detail
    };

    try {
      const { data, error } = await supabase
        .from('inventory')
        .insert([newEntry])
        .select();
      
      if (error) throw error;
      if (data) {
        // Map snake_case from DB to camelCase for UI
        const mappedData: InventoryEntry = {
          id: data[0].id,
          date: data[0].date,
          product: data[0].product,
          quantity: data[0].quantity,
          type: data[0].type,
          reason: data[0].reason,
          orderNumber: data[0].order_number,
          detail: data[0].detail
        };
        setInventory([mappedData, ...inventory]);
      }
      setIsInvModalOpen(false);
      setInvForm({ product: 'Paquete Standard', quantity: '', date: format(new Date(), 'yyyy-MM-dd'), type: 'entrada', reason: 'venta', orderNumber: '', detail: '' });
    } catch (error) {
      console.error('Error adding inventory:', error);
      alert('Error al guardar en Supabase');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      const table = deleteConfirm.type === 'caja' ? 'transactions' : 'inventory';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', deleteConfirm.id);
      
      if (error) throw error;

      if (deleteConfirm.type === 'caja') {
        setTransactions(prev => prev.filter(t => t.id !== deleteConfirm.id));
      } else {
        setInventory(prev => prev.filter(i => i.id !== deleteConfirm.id));
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Error al eliminar de Supabase');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        const img = new Image();
        img.onload = async () => {
          const dims = { w: img.naturalWidth, h: img.naturalHeight };
          setLogo(base64);
          setLogoDims(dims);

          // Persist to Supabase
          setIsSavingLogo(true);
          try {
            const { error } = await supabase
              .from('settings')
              .upsert({ 
                id: 'global', 
                logo_url: base64, 
                logo_dims: dims,
                updated_at: new Date().toISOString()
              });
            if (error) throw error;
          } catch (error) {
            console.error('Error saving logo:', error);
            alert('Error al guardar el logo en la base de datos');
          } finally {
            setIsSavingLogo(false);
          }
        };
        img.src = base64;
      };
      reader.readAsDataURL(file);
    }
  };

  // Filter logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = parseISO(t.date);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    });
  }, [transactions, monthStart, monthEnd]);

  // Map inventory from DB if needed (already handled in handleAddInv, but for initial fetch)
  const mappedInventory = useMemo(() => {
    return inventory.map(i => ({
      ...i,
      orderNumber: (i as any).order_number || i.orderNumber
    }));
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return mappedInventory.filter(i => {
      const date = parseISO(i.date);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    });
  }, [mappedInventory, monthStart, monthEnd]);

  // Totals Caja
  const totalsCaja = useMemo(() => {
    const ingresos = filteredTransactions.filter(t => t.type === 'ingreso').reduce((acc, t) => acc + t.amount, 0);
    const egresos = filteredTransactions.filter(t => t.type === 'egreso').reduce((acc, t) => acc + t.amount, 0);
    return { ingresos, egresos, total: ingresos - egresos };
  }, [filteredTransactions]);

  // Totals Inventario
  const totalsInventory = useMemo(() => {
    const entradas = filteredInventory.filter(i => i.type === 'entrada').reduce((acc, i) => acc + i.quantity, 0);
    const salidas = filteredInventory.filter(i => i.type === 'salida').reduce((acc, i) => acc + i.quantity, 0);
    const totalEntradas = inventory.filter(i => i.type === 'entrada').reduce((acc, i) => acc + i.quantity, 0);
    const totalSalidas = inventory.filter(i => i.type === 'salida').reduce((acc, i) => acc + i.quantity, 0);
    return { entradas, salidas, total: totalEntradas - totalSalidas };
  }, [filteredInventory, inventory]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const exportCajaPDF = () => {
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [206, 253, 123]; // #CEFD7B
    const darkColor: [number, number, number] = [9, 9, 11]; // #09090b
    
    // Header Background
    doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.rect(0, 0, 210, 40, 'F');

    if (logo && logoDims) {
      const maxWidth = 25;
      const ratio = logoDims.h / logoDims.w;
      const h = maxWidth * ratio;
      doc.addImage(logo, 'PNG', 14, 8, maxWidth, h);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('SANAVI INTERNATIONAL', 50, 22);

    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(18);
    doc.text(`Reporte Caja Chica`, 14, 55);
    doc.setFontSize(10);
    doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 60);
    doc.setFontSize(12);
    doc.text(`${format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase()}`, 14, 67);
    
    const tableData = filteredTransactions.map(t => [
      t.date,
      t.detail,
      t.type.toUpperCase(),
      `$${t.amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Fecha', 'Detalle', 'Tipo', 'Monto']],
      body: tableData,
      headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      foot: [['', 'TOTALES', '', `$${totalsCaja.total.toFixed(2)}`]],
      footStyles: { fillColor: primaryColor, textColor: darkColor, fontStyle: 'bold' },
    });

    // Footer Signature
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.text('__________________________', 14, finalY);
    doc.text('Giovanni Coto', 14, finalY + 5);
    doc.text('Director general para Latinoamérica', 14, finalY + 10);

    doc.save(`Caja_Chica_${format(currentDate, 'yyyy_MM')}.pdf`);
  };

  const exportInventoryPDF = () => {
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [206, 253, 123];
    const darkColor: [number, number, number] = [9, 9, 11];

    // Header Background
    doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.rect(0, 0, 210, 40, 'F');

    if (logo && logoDims) {
      const maxWidth = 25;
      const ratio = logoDims.h / logoDims.w;
      const h = maxWidth * ratio;
      doc.addImage(logo, 'PNG', 14, 8, maxWidth, h);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('SANAVI INTERNATIONAL', 50, 22);

    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(18);
    doc.text(`Reporte Inventario`, 14, 55);
    doc.setFontSize(10);
    doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 60);
    doc.setFontSize(12);
    doc.text(`${format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase()}`, 14, 67);
    
    const tableData = filteredInventory.map(i => [
      i.date,
      i.product,
      i.type.toUpperCase(),
      i.quantity,
      i.reason || '-',
      i.orderNumber || '-'
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Fecha', 'Producto', 'Tipo', 'Cant', 'Motivo', 'Orden']],
      body: tableData,
      headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      foot: [['', 'STOCK TOTAL', '', totalsInventory.total.toString(), '', '']],
      footStyles: { fillColor: primaryColor, textColor: darkColor, fontStyle: 'bold' },
    });

    // Footer Signature
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.text('__________________________', 14, finalY);
    doc.text('Giovanni Coto', 14, finalY + 5);
    doc.text('Director general para Latinoamérica', 14, finalY + 10);

    doc.save(`Inventario_${format(currentDate, 'yyyy_MM')}.pdf`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Background Gradients */}
      <div className="fixed inset-0 bg-dark z-[-1]" />
      <div className="fixed -top-[10%] -right-[10%] w-[50%] h-[50%] bg-prime/20 blur-[120px] rounded-full z-[-1]" />
      <div className="fixed -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-zinc-800/30 blur-[100px] rounded-full z-[-1]" />

      {/* Header */}
      <header className="px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <div className="relative group">
            {logo ? (
              <div className="relative">
                <img src={logo} alt="Logo" className={cn(
                  "w-12 h-12 rounded-2xl object-contain bg-white/5 p-1 border border-white/10 transition-opacity",
                  isSavingLogo && "opacity-50"
                )} />
                {isSavingLogo && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-prime/20 border-t-prime rounded-full animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-12 h-12 bg-prime rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(206,253,123,0.4)]">
                <span className="text-dark font-display font-black text-xl italic">S</span>
              </div>
            )}
            <label className="absolute -bottom-2 -right-2 p-1.5 bg-zinc-800 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity border border-white/10">
              <Upload size={10} className="text-prime" />
              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
            </label>
          </div>
          <div>
            <h1 className="text-2xl font-brand font-black tracking-tighter text-gradient uppercase">SANAVI INTERNATIONAL</h1>
            <div className="flex flex-col">
              <p className="text-zinc-400 text-[10px] font-bold tracking-wider uppercase">Giovanni Coto</p>
              <p className="text-zinc-500 text-[8px] font-medium tracking-[0.1em] uppercase">Director general para Latinoamérica</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 glass p-1.5 rounded-2xl">
          <button 
            onClick={() => setActiveTab('caja')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2",
              activeTab === 'caja' ? "bg-prime text-dark shadow-lg" : "text-zinc-400 hover:text-white"
            )}
          >
            <Wallet size={16} />
            Caja Chica
          </button>
          <button 
            onClick={() => setActiveTab('inventario')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2",
              activeTab === 'inventario' ? "bg-prime text-dark shadow-lg" : "text-zinc-400 hover:text-white"
            )}
          >
            <Package size={16} />
            Inventario
          </button>
        </div>

        <div className="flex items-center gap-4 glass px-4 py-2 rounded-2xl">
          <button onClick={handlePrevMonth} className="p-1 hover:text-prime transition-colors"><ChevronLeft size={20}/></button>
          <div className="flex items-center gap-2 min-w-[140px] justify-center text-center">
            <Calendar size={16} className="text-prime shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </span>
          </div>
          <button onClick={handleNextMonth} className="p-1 hover:text-prime transition-colors"><ChevronRight size={20}/></button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 pb-12 max-w-7xl mx-auto w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-prime/20 border-t-prime rounded-full animate-spin" />
            <p className="text-zinc-500 font-medium animate-pulse">Cargando datos de SANAVI...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
          {activeTab === 'caja' ? (
            <motion.div
              key="caja"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  title="Ingresos Mensuales" 
                  value={`$${totalsCaja.ingresos.toFixed(2)}`} 
                  icon={ArrowUpRight} 
                  trend="+12% vs last month"
                />
                <StatCard 
                  title="Egresos Mensuales" 
                  value={`$${totalsCaja.egresos.toFixed(2)}`} 
                  icon={ArrowDownRight} 
                  color="rose-400"
                />
                <StatCard 
                  title="Balance Total" 
                  value={`$${totalsCaja.total.toFixed(2)}`} 
                  icon={Wallet} 
                  color="prime"
                />
              </div>

              {/* Actions & Table */}
              <GlassCard className="p-0 overflow-hidden">
                <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <h2 className="text-xl font-display font-bold flex items-center gap-3">
                    <FileText className="text-prime" size={24} />
                    Detalle de Movimientos
                  </h2>
                  <div className="flex gap-3">
                    <button 
                      onClick={exportCajaPDF}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-all"
                    >
                      <Download size={16} />
                      PDF
                    </button>
                    <button 
                      onClick={() => setIsCajaModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-prime text-dark text-sm font-bold hover:scale-105 transition-all shadow-[0_0_15px_rgba(206,253,123,0.3)]"
                    >
                      <Plus size={16} />
                      Nuevo Registro
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                        <th className="px-6 py-4 font-semibold">Fecha</th>
                        <th className="px-6 py-4 font-semibold">Detalle</th>
                        <th className="px-6 py-4 font-semibold">Tipo</th>
                        <th className="px-6 py-4 font-semibold text-right">Monto</th>
                        <th className="px-6 py-4 font-semibold text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                        <tr key={t.id} className="group hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-sm text-zinc-400">{format(parseISO(t.date), 'dd MMM yyyy', { locale: es })}</td>
                          <td className="px-6 py-4 text-sm font-medium">{t.detail}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                              t.type === 'ingreso' ? "bg-prime/10 text-prime" : "bg-rose-500/10 text-rose-400"
                            )}>
                              {t.type}
                            </span>
                          </td>
                          <td className={cn(
                            "px-6 py-4 text-sm font-bold text-right",
                            t.type === 'ingreso' ? "text-prime" : "text-rose-400"
                          )}>
                            {t.type === 'ingreso' ? '+' : '-'}${t.amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => setDeleteConfirm({ id: t.id, type: 'caja' })}
                              className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 text-sm italic">
                            No hay movimientos registrados en este mes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          ) : (
            <motion.div
              key="inventario"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  title="Stock Total Prime X" 
                  value={totalsInventory.total} 
                  icon={Package} 
                />
                <StatCard 
                  title="Ingresos del Mes" 
                  value={totalsInventory.entradas} 
                  icon={TrendingUp} 
                  color="prime"
                />
                <StatCard 
                  title="Egresos del Mes" 
                  value={totalsInventory.salidas} 
                  icon={TrendingDown} 
                  color="rose-400"
                />
              </div>

              {/* Actions & Table */}
              <GlassCard className="p-0 overflow-hidden">
                <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <h2 className="text-xl font-display font-bold flex items-center gap-3">
                    <LayoutDashboard className="text-prime" size={24} />
                    Movimientos de Inventario
                  </h2>
                  <div className="flex gap-3">
                    <button 
                      onClick={exportInventoryPDF}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-all"
                    >
                      <Download size={16} />
                      PDF
                    </button>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setInvForm({...invForm, type: 'entrada'}); setIsInvModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-all"
                      >
                        <TrendingUp size={16} className="text-prime" />
                        Entrada
                      </button>
                      <button 
                        onClick={() => { setInvForm({...invForm, type: 'salida'}); setIsInvModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-prime text-dark text-sm font-bold hover:scale-105 transition-all shadow-[0_0_15px_rgba(206,253,123,0.3)]"
                      >
                        <TrendingDown size={16} />
                        Salida
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                        <th className="px-6 py-4 font-semibold">Fecha</th>
                        <th className="px-6 py-4 font-semibold">Producto</th>
                        <th className="px-6 py-4 font-semibold">Tipo</th>
                        <th className="px-6 py-4 font-semibold">Cant.</th>
                        <th className="px-6 py-4 font-semibold">Motivo</th>
                        <th className="px-6 py-4 font-semibold">Orden</th>
                        <th className="px-6 py-4 font-semibold text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredInventory.length > 0 ? filteredInventory.map((i) => (
                        <tr key={i.id} className="group hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-sm text-zinc-400">{format(parseISO(i.date), 'dd MMM yyyy', { locale: es })}</td>
                          <td className="px-6 py-4 text-sm font-medium">{i.product}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                              i.type === 'entrada' ? "bg-prime/10 text-prime" : "bg-rose-500/10 text-rose-400"
                            )}>
                              {i.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold">
                            {i.type === 'entrada' ? '+' : '-'}{i.quantity}
                          </td>
                          <td className="px-6 py-4">
                            {i.reason ? (
                              <div className="flex items-center gap-2 text-xs text-zinc-400">
                                {i.reason === 'venta' ? <ShoppingCart size={12} className="text-prime" /> : <Gift size={12} className="text-amber-400" />}
                                <span className="capitalize">{i.reason}</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-zinc-500">
                            {i.orderNumber || '-'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => setDeleteConfirm({ id: i.id, type: 'inventario' })}
                              className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-sm italic">
                            No hay movimientos de inventario en este mes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isCajaModalOpen} 
        onClose={() => setIsCajaModalOpen(false)} 
        title="Nuevo Registro de Caja"
      >
        <form onSubmit={handleAddCaja} className="space-y-4">
          <Input 
            label="Detalle" 
            placeholder="Ej: Venta de producto..." 
            required 
            value={cajaForm.detail}
            onChange={e => setCajaForm({...cajaForm, detail: e.target.value})}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Monto (USD)" 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              required 
              value={cajaForm.amount}
              onChange={e => setCajaForm({...cajaForm, amount: e.target.value})}
            />
            <Input 
              label="Fecha" 
              type="date" 
              required 
              value={cajaForm.date}
              onChange={e => setCajaForm({...cajaForm, date: e.target.value})}
            />
          </div>
          <Select 
            label="Tipo de Movimiento" 
            value={cajaForm.type}
            onChange={e => setCajaForm({...cajaForm, type: e.target.value as TransactionType})}
            options={[
              { value: 'ingreso', label: 'Ingreso' },
              { value: 'egreso', label: 'Egreso' }
            ]}
          />
          <button type="submit" className="w-full py-3 bg-prime text-dark font-bold rounded-xl mt-4 hover:scale-[1.02] transition-all">
            Guardar Registro
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={isInvModalOpen} 
        onClose={() => setIsInvModalOpen(false)} 
        title={invForm.type === 'entrada' ? "Ingreso de Inventario" : "Egreso de Inventario"}
      >
        <form onSubmit={handleAddInv} className="space-y-4">
          <Select 
            label="Producto" 
            value={invForm.product}
            onChange={e => setInvForm({...invForm, product: e.target.value})}
            options={[
              { value: 'Paquete Standard', label: 'Paquete Standard' },
              { value: 'Paquete Profesional', label: 'Paquete Profesional' },
              { value: 'Paquete temporada', label: 'Paquete temporada' }
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Cantidad" 
              type="number" 
              placeholder="0" 
              required 
              value={invForm.quantity}
              onChange={e => setInvForm({...invForm, quantity: e.target.value})}
            />
            <Input 
              label="Fecha" 
              type="date" 
              required 
              value={invForm.date}
              onChange={e => setInvForm({...invForm, date: e.target.value})}
            />
          </div>
          
          {invForm.type === 'salida' && (
            <>
              <Select 
                label="Motivo" 
                value={invForm.reason}
                onChange={e => setInvForm({...invForm, reason: e.target.value as ExitReason})}
                options={[
                  { value: 'venta', label: 'Venta' },
                  { value: 'regalia', label: 'Regalía' }
                ]}
              />
              {invForm.reason === 'venta' && (
                <Input 
                  label="Número de Orden" 
                  placeholder="Ej: ORD-001" 
                  value={invForm.orderNumber}
                  onChange={e => setInvForm({...invForm, orderNumber: e.target.value})}
                />
              )}
            </>
          )}
          
          <Input 
            label="Detalle Adicional" 
            placeholder="Ej: Cliente Juan..." 
            value={invForm.detail}
            onChange={e => setInvForm({...invForm, detail: e.target.value})}
          />

          <button type="submit" className="w-full py-3 bg-prime text-dark font-bold rounded-xl mt-4 hover:scale-[1.02] transition-all">
            Confirmar {invForm.type === 'entrada' ? 'Ingreso' : 'Egreso'}
          </button>
        </form>
      </Modal>
      
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmar Eliminación"
      >
        <div className="space-y-6">
          <p className="text-zinc-400 text-sm leading-relaxed">
            ¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleDeleteConfirm}
              className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-xl text-sm hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
            >
              Eliminar
            </button>
          </div>
        </div>
      </Modal>

      {/* Footer / Branding */}
      <footer className="px-6 py-8 border-t border-white/5 text-center">
        <p className="text-zinc-600 text-[10px] font-medium uppercase tracking-[0.3em]">
          Powered by SANAVI INTERNATIONAL Prime X Engine &copy; 2026
        </p>
      </footer>
    </div>
  );
}
