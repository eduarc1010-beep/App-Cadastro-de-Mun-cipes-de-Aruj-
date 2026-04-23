/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  User as UserIcon, 
  MapPin, 
  Home, 
  Save, 
  Eraser, 
  Edit, 
  Search, 
  Trash2, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Info,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  Users,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { Municipe, User } from './types';

const INITIAL_FORM: Municipe = {
  nome: '',
  cpf: '',
  dataNasc: '',
  contato: '',
  email: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  estado: '',
  moradores: '',
  adultos: '',
  interesse: '',
  data: ''
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState(false);
  
  const [form, setForm] = useState<Municipe>(INITIAL_FORM);
  const [dataNascMasked, setDataNascMasked] = useState('');
  const [nomeOriginal, setNomeOriginal] = useState('');
  const [modo, setModo] = useState<'pesquisa' | 'editar' | null>(null);
  const [status, setStatus] = useState<{ msg: string; tipo: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [userList, setUserList] = useState<any[]>([]);
  const [selectedUserForReset, setSelectedUserForReset] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const [isDuplicateFound, setIsDuplicateFound] = useState(false);
  const [btnToggle, setBtnToggle] = useState(false);
  const searchBtnRef = React.useRef<HTMLButtonElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);
  const alertRef = React.useRef<HTMLDivElement>(null);
  const nomeInputRef = React.useRef<HTMLInputElement>(null);

  const inputNumeroRef = React.useRef<HTMLInputElement>(null);

  // Auto-scroll to top on tab change or login
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    topRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [activeTab, user]);

  // Toggle animation and scroll for Buscar/Editar button
  useEffect(() => {
    let interval: any;
    if (isDuplicateFound) {
      // Immediate scroll attempt
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      topRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });

      // Secondary check to ensure it scrolled to the alert specifically
      const timer = setTimeout(() => {
        if (alertRef.current) {
          alertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          window.scrollTo(0, 0);
          topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);

      interval = setInterval(() => {
        setBtnToggle(prev => !prev);
      }, 700);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    } else {
      setBtnToggle(false);
    }
    return () => clearInterval(interval);
  }, [isDuplicateFound]);

  // Login Logic
  const handleLogin = async () => {
    const u = loginForm.username.trim();
    const s = loginForm.password;

    if (!u || !s) {
      setLoginError(true);
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: s })
      });
      const result = await resp.json();
      
      if (result.success) {
        setUser(result.user);
        setLoginError(false);
      } else {
        setLoginError(true);
        setLoginForm(prev => ({ ...prev, password: '' }));
      }
    } catch (err) {
      showStatus("Erro ao conectar com o servidor.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setAdminLoading(true);
    try {
      const resp = await fetch('/api/usuarios');
      const result = await resp.json();
      setUserList(result.users || []);
    } catch (err) {
      showStatus("Erro ao carregar usuários.", "error");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!selectedUserForReset || !newPassword.trim()) return;
    
    setAdminLoading(true);
    try {
      const resp = await fetch('/api/usuarios/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: selectedUserForReset.username, 
          newPassword: newPassword.trim() 
        })
      });
      
      if (resp.ok) {
        showStatus("Senha atualizada com sucesso!", "success");
        setSelectedUserForReset(null);
        setNewPassword('');
        loadUsers();
      } else {
        showStatus("Erro ao atualizar senha.", "error");
      }
    } catch (err) {
      showStatus("Erro de conexão.", "error");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setLoginForm({ username: '', password: '' });
    setLoginError(false);
    handleLimpar();
  };

  // Status Helper
  const showStatus = (msg: string, tipo: 'success' | 'error' | 'warning' | 'info', dur = 3500) => {
    setStatus({ msg, tipo });
    
    // Auto-scroll to top to ensure user sees the message
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTop = 0;

    if (dur > 0) {
      setTimeout(() => setStatus(null), dur);
    }
  };

  // CEP Lookup
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted = v.replace(/(\d{5})(\d)/, "$1-$2");
    setForm(prev => ({ ...prev, cep: formatted }));

    if (v.length === 8) {
      setCepLoading(true);
      try {
        const resp = await fetch(`https://viacep.com.br/ws/${v}/json/`);
        const data = await resp.json();
        if (data && !data.erro) {
          setForm(prev => ({
            ...prev,
            logradouro: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || ""
          }));
          showStatus("Endereço preenchido automaticamente.", "success");
          setTimeout(() => inputNumeroRef.current?.focus(), 100);
        } else {
          showStatus("CEP não encontrado.", "warning");
        }
      } catch (err) {
        showStatus("Erro ao buscar CEP.", "error");
      } finally {
        setCepLoading(false);
      }
    }
  };

  const handleBuscarCepPorEndereco = async (isAutomatic = false) => {
    const { estado, cidade, logradouro } = form;
    
    if (!estado || !cidade || logradouro.length < 3) {
      if (!isAutomatic) {
        showStatus("Preencha UF, Cidade e pelo menos 3 letras do Logradouro para buscar o CEP.", "warning");
      }
      return;
    }

    setCepLoading(true);
    try {
      const uf = estado.trim();
      const city = cidade.trim();
      const street = logradouro.trim();

      const resp = await fetch(`https://viacep.com.br/ws/${uf}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`);
      const data = await resp.json();

      if (Array.isArray(data) && data.length > 0) {
        // Take the first match
        const match = data[0];
        setForm(prev => ({
          ...prev,
          cep: match.cep,
          ...(match.bairro && !prev.bairro ? { bairro: match.bairro } : {})
        }));
        if (!isAutomatic) {
          showStatus("CEP localizado e preenchido.", "success");
        }
      } else {
        if (!isAutomatic) {
          showStatus("Nenhum CEP encontrado para este endereço.", "warning");
        }
      }
    } catch (err) {
      if (!isAutomatic) {
        showStatus("Erro ao buscar CEP pelo endereço.", "error");
      }
    } finally {
      setCepLoading(false);
    }
  };

  // Auto-fetch CEP when address is complete and CEP is empty
  useEffect(() => {
    const { estado, cidade, logradouro, cep } = form;
    // Only search if CEP is effectively blank and we have the basics
    if (activeTab === 2 && !cep.trim() && estado && cidade && logradouro.length >= 7) {
      const timer = setTimeout(() => {
        handleBuscarCepPorEndereco(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [form.estado, form.cidade, form.logradouro]);

  // CRUD Operations
  const handleSalvar = async () => {
    if (!form.nome || !form.interesse) {
      showStatus("Nome e Interesse são obrigatórios.", "error");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, usuarioResponsavel: user?.nome })
      });
      const result = await resp.json();
      
      if (!resp.ok) {
        showStatus(result.error || "Erro ao salvar.", "error");
        return;
      }

      if (result.status === "SALVO") {
        showStatus("Munícipe cadastrado com sucesso!", "success");
        handleLimpar();
      } else if (result.status === "NOME_REPETIDO") {
        showStatus("Nome já cadastrado.", "warning");
      }
    } catch (err) {
      showStatus("Erro ao salvar.", "error");
    } finally {
      setLoading(false);
    }
  };

  const checkNomeExistente = async (nome: string) => {
    if (!nome.trim() || isEditing) return false;
    try {
      const resp = await fetch(`/api/pesquisar?nome=${encodeURIComponent(nome)}`);
      const result = await resp.json();
      return !!result.data;
    } catch (err) {
      return false;
    }
  };

  const handleAvancarTab1 = async () => {
    if (!form.nome.trim()) {
      showStatus("O campo Nome Completo é de preenchimento obrigatório.", "warning");
      nomeInputRef.current?.focus();
      return;
    }

    if (!isEditing) {
      setLoading(true);
      const existe = await checkNomeExistente(form.nome);
      setLoading(false);
      if (existe) {
        setIsDuplicateFound(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.documentElement.scrollTop = 0;
        return;
      }
    }

    setActiveTab(2);
  };

  const handlePesquisar = async () => {
    const nomeBusca = isSearchOpen ? searchTerm : form.nome;
    
    if (!nomeBusca.trim()) {
      showStatus("Informe o Nome para pesquisar.", "warning");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/api/pesquisar?nome=${encodeURIComponent(nomeBusca)}`);
      const result = await resp.json();
      
      if (!resp.ok) {
        showStatus(result.error || "Erro na pesquisa.", "error");
        return;
      }

      if (result.data) {
        const d = result.data;
        setForm({
          data: d[0] || '',
          nome: d[1] || '',
          cpf: d[2] || '',
          dataNasc: d[3] || '',
          contato: d[4] || '',
          email: d[5] || '',
          cep: d[6] || '',
          logradouro: d[7] || '',
          numero: d[8] || '',
          bairro: d[9] || '',
          cidade: d[10] || '',
          estado: d[11] || '',
          moradores: d[12] || '',
          adultos: d[13] || '',
          interesse: d[14] || ''
        });
        setNomeOriginal(d[1] || '');
        setModo('editar');
        showStatus("Munícipe encontrado.", "success");
        setIsSearchOpen(false); // Close search screen after finding
        setSearchTerm('');
        setActiveTab(1); // Set to identification tab
        setIsDuplicateFound(false);
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
      } else {
        showStatus("Não encontrado.", "warning");
      }
    } catch (err) {
      showStatus("Erro na pesquisa.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = async () => {
    if (!nomeOriginal) {
      showStatus("Pesquise um munícipe antes de editar.", "warning");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/editar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, nomeOriginal, usuarioResponsavel: user?.nome })
      });
      const result = await resp.json();

      if (!resp.ok) {
        showStatus(result.error || "Erro ao editar.", "error");
        return;
      }

      if (result.status === "EDITADO") {
        showStatus("Registro atualizado com sucesso!", "success");
        handleLimpar();
      } else {
        showStatus("Registro não encontrado.", "warning");
      }
    } catch (err) {
      showStatus("Erro ao editar.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExcluir = async () => {
    if (!form.nome.trim()) {
      showStatus("Informe o Nome para excluir.", "warning");
      return;
    }
    setShowConfirmDelete(true);
  };

  const confirmExcluir = async () => {
    setShowConfirmDelete(false);
    setLoading(true);
    try {
      const resp = await fetch('/api/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.nome })
      });
      const result = await resp.json();

      if (!resp.ok) {
        showStatus(result.error || "Erro ao excluir.", "error");
        return;
      }

      if (result.status === "EXCLUIDO") {
        showStatus("Cadastro excluído.", "success");
        handleLimpar();
      } else {
        showStatus("Registro não encontrado.", "warning");
      }
    } catch (err) {
      showStatus("Erro ao excluir.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLimpar = () => {
    setForm(INITIAL_FORM);
    setNomeOriginal('');
    setModo(null);
    setStatus(null);
    setActiveTab(1);
    setIsDuplicateFound(false);
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  };

  // Sync masked date with form date (ISO -> BR)
  useEffect(() => {
    if (form.dataNasc && form.dataNasc.includes('-')) {
      const [y, m, d] = form.dataNasc.split('-');
      setDataNascMasked(`${d}/${m}/${y}`);
    } else if (!form.dataNasc) {
      setDataNascMasked('');
    }
  }, [form.dataNasc]);

  // Mask Helpers
  const handleCpfInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    v = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    setForm(prev => ({ ...prev, cpf: v.slice(0, 14) }));
  };

  const handleContatoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (v.length <= 10) {
      v = v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    } else {
      v = v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
    }
    setForm(prev => ({ ...prev, contato: v }));
  };

  const handleDataNascInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 8);
    if (v.length >= 3 && v.length <= 4) {
      v = v.replace(/(\d{2})(\d)/, "$1/$2");
    } else if (v.length >= 5) {
      v = v.replace(/(\d{2})(\d{2})(\d)/, "$1/$2/$3");
    }
    setDataNascMasked(v);

    // If complete date, sync with form (BR -> ISO)
    if (v.length === 10) {
      const [d, m, y] = v.split('/');
      if (d && m && y && y.length === 4) {
        setForm(prev => ({ ...prev, dataNasc: `${y}-${m}-${d}` }));
      }
    } else if (v.length === 0) {
      setForm(prev => ({ ...prev, dataNasc: '' }));
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#1A3AAB]">
        <div ref={topRef} className="absolute top-0 left-0 w-0 h-0" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center"
        >
          <div className="w-20 h-20 mb-6 flex items-center justify-center">
             <img src="https://www.camaraaruja.sp.gov.br/Arquivos/Paginas/Brasao_VETOR.svg" alt="Brasão Arujá" className="w-full h-full object-contain" />
          </div>
          
          <div className="text-center mb-10">
            <h1 className="text-[#1A1F36] text-2xl font-black tracking-tight">Cadastro de Munícipes</h1>
            <p className="text-[#6B7280] text-sm mt-1">Arujá SP - Gabinete 10</p>
          </div>

          <div className="w-full space-y-4">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <UserIcon size={18} />
              </div>
              <input 
                type="text" 
                className="w-full h-[52px] pl-12 pr-4 bg-white border border-[#D1D5DB] rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-gray-400 text-sm"
                placeholder="Usuário"
                value={loginForm.username}
                onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                className="w-full h-[52px] pl-12 pr-12 bg-white border border-[#D1D5DB] rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-gray-400 text-sm"
                placeholder="Senha"
                value={loginForm.password}
                onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <AnimatePresence>
              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 text-red-700 border border-red-100 rounded-lg p-3 text-xs font-medium flex items-center gap-2"
                >
                  <AlertCircle size={14} />
                  Credenciais incorretas.
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              onClick={handleLogin}
              className="w-full h-[52px] bg-[#1A3AAB] text-white rounded-xl font-bold transition-all hover:bg-[#152e89] active:scale-[0.98] shadow-lg shadow-[#1A3AAB]/20"
            >
              Entrar no Sistema
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const isEditing = modo === 'editar';

  if (isSearchOpen) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <header className="bg-[#1A3AAB] text-white pt-2 pb-4 px-4 shadow-lg sticky top-0 z-[60]">
          <div className="flex items-center gap-3 max-w-5xl mx-auto w-full">
            <button 
              onClick={() => setIsSearchOpen(false)}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-lg font-black tracking-tight">Pesquisar Munícipe</h1>
          </div>
        </header>

        <div className="flex-1 max-w-2xl mx-auto w-full p-6 pt-10 space-y-8">
           <div className="space-y-2">
             <label className="text-sm font-black text-gray-800">Nome do Munícipe</label>
             <input 
               autoFocus
               className="input-polish"
               placeholder="Digite o nome exato para buscar"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handlePesquisar()}
             />
           </div>

           <button 
             onClick={handlePesquisar}
             disabled={loading}
             className="btn-polish-primary w-full shadow-lg shadow-primary/20 h-[56px] text-sm sm:text-base transition-transform active:scale-95"
           >
             {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
             <span className="font-black uppercase tracking-wider">Buscar Registro</span>
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div ref={topRef} className="absolute top-0 left-0 w-0 h-0" />
      {/* Official Header */}
      <header className="bg-[#1A3AAB] text-white pt-2 pb-4 px-4 shadow-lg sticky top-0 z-[60]">
        <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center p-1 shadow-inner">
               <img 
                 src="https://www.camaraaruja.sp.gov.br/Arquivos/Paginas/Brasao_VETOR.svg" 
                 alt="Brasão Arujá" 
                 className="w-full h-full object-contain" 
               />
             </div>
             <div className="flex flex-col items-center justify-center">
               <h1 className="text-base font-black leading-tight tracking-tight">Cadastro de Munícipes</h1>
               <p className="text-xs font-black text-blue-200 uppercase tracking-[0.2em] mt-0.5">ARUJÁ - SP</p>
             </div>
          </div>
          
            <div className="flex items-center gap-2 sm:gap-3">
              <div 
                className={cn(
                  "flex flex-col items-end mr-1 transition-all",
                  user.perfil === 'admin' && "cursor-pointer hover:opacity-80 active:scale-95"
                )}
                onClick={() => {
                  if (user.perfil === 'admin') {
                    setIsAdminModalOpen(true);
                    loadUsers();
                  }
                }}
                title={user.perfil === 'admin' ? "Gerenciar Usuários" : undefined}
              >
                <span className="text-[9px] sm:text-[11px] font-bold text-blue-200 leading-none">Usuário Logado</span>
                <span className={cn(
                  "text-[10px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 leading-none mt-1",
                  user.perfil === 'admin' ? "text-green-400" : "text-amber-400"
                )}>
                  <UserCheck size={12} className="sm:w-3.5 sm:h-3.5" />
                  {user.nome}
                </span>
              </div>
            <button 
              onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Official Edit Banner */}
      {isEditing && (
        <div className="bg-[#FFD700] py-2 flex items-center justify-center gap-2 border-b border-black/5">
          <Edit size={14} className="text-black" />
          <span className="text-xs font-black text-black uppercase tracking-[0.15em]">EDITANDO REGISTRO</span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto pb-24">
        
        {/* Duplicate Warning Prompt */}
        <AnimatePresence>
          {isDuplicateFound && (
            <motion.div 
              ref={alertRef}
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="bg-red-600 text-white px-4 py-4 flex items-center justify-center gap-3 overflow-hidden shadow-lg scroll-mt-20"
            >
              <AlertCircle size={24} className="animate-pulse" />
              <div className="flex flex-col items-center">
                <span className="text-sm font-black uppercase tracking-[0.2em]">Atenção: Munícipe já cadastrado</span>
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-0.5">Utilize o botão "EDITAR" acima para carregar os dados</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Indicator (Stepper) */}
        <div className="py-6 px-4 bg-gray-50/50 border-b border-gray-100 mb-6">
          <div className="flex items-center justify-between max-w-md mx-auto relative px-2">
            {/* Connector Line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-10" />
            <div 
              className="absolute top-4 left-0 h-0.5 bg-[#1A3AAB] transition-all duration-500 -z-10" 
              style={{ width: `${(activeTab - 1) * 50}%` }}
            />

            {[
              { id: 1, label: 'Identificação' },
              { id: 2, label: 'Endereço' },
              { id: 3, label: 'Domicílio' }
            ].map((step) => (
              <div key={step.id} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => setActiveTab(step.id)}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300",
                  activeTab > step.id ? "bg-[#1A3AAB] text-white" : 
                  activeTab === step.id ? "bg-[#1A3AAB] text-white ring-4 ring-blue-100" : "bg-white border-2 border-gray-200 text-gray-400"
                )}>
                  {activeTab > step.id ? <CheckCircle2 size={16} /> : step.id}
                </div>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider transition-colors duration-300",
                  activeTab >= step.id ? "text-[#1A3AAB]" : "text-gray-400 font-medium"
                )}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="px-4 flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 1 && (
              <motion.div
                key="tab1"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between gap-2 mb-4 border-b border-gray-100 pb-2">
                   <div className="flex items-center gap-2">
                     <UserIcon size={20} className="text-[#1A3AAB]" />
                     <h2 className="text-lg font-black text-gray-800">Dados Pessoais</h2>
                   </div>
                   <button 
                     ref={searchBtnRef}
                     onClick={() => {
                        if (isDuplicateFound) {
                          handlePesquisar();
                        } else {
                          setIsSearchOpen(true);
                        }
                     }} 
                     className={cn(
                       "flex items-center justify-center gap-2 w-[100px] px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95",
                       isDuplicateFound && btnToggle 
                         ? "bg-red-600 text-white" 
                         : "bg-[#1A3AAB] text-white hover:bg-[#1A3AAB]/90"
                     )}
                   >
                      <Search size={14} />
                      {isDuplicateFound && btnToggle ? "Editar" : "Buscar"}
                   </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="label-polish">Nome Completo <span className="text-red-500">*</span></label>
                    <input 
                      ref={nomeInputRef}
                      className={cn(
                        "input-polish",
                        !form.nome.trim() && "border-red-200 focus:border-red-400"
                      )}
                      placeholder="Nome do munícipe"
                      value={form.nome}
                      onChange={e => {
                        const newVal = e.target.value;
                        setForm(prev => ({ ...prev, nome: newVal }));
                        if (isDuplicateFound) setIsDuplicateFound(false);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleAvancarTab1();
                        }
                      }}
                      onBlur={async () => {
                        if (form.nome.trim() && !isEditing) {
                          const existe = await checkNomeExistente(form.nome);
                          if (existe) {
                            setIsDuplicateFound(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            document.documentElement.scrollTop = 0;
                            setTimeout(() => searchBtnRef.current?.focus(), 100);
                          } else {
                            setIsDuplicateFound(false);
                          }
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="label-polish">CPF <span className="text-[10px] font-normal text-gray-400">(opcional)</span></label>
                    <input 
                      disabled={isDuplicateFound || !form.nome.trim()}
                      className={cn(
                        "input-polish",
                        (!form.nome.trim() || isDuplicateFound) && "opacity-60 cursor-not-allowed bg-gray-50"
                      )}
                      title={!form.nome.trim() ? "Preencha o Nome Completo primeiro" : undefined}
                      placeholder="000.000.000-00"
                      value={form.cpf}
                      onChange={handleCpfInput}
                    />
                  </div>
                  <div>
                    <label className="label-polish">Nascimento <span className="text-[10px] font-normal text-gray-400">(opcional)</span></label>
                    <div className="relative">
                      <input 
                        disabled={isDuplicateFound || !form.nome.trim()}
                        type="text"
                        className={cn(
                          "input-polish pr-12",
                          (!form.nome.trim() || isDuplicateFound) && "opacity-60 cursor-not-allowed bg-gray-50"
                        )}
                        title={!form.nome.trim() ? "Preencha o Nome Completo primeiro" : undefined}
                        placeholder="dd/mm/aaaa"
                        value={dataNascMasked}
                        onChange={handleDataNascInput}
                        maxLength={10}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <label className={cn(
                          "transition-colors",
                          (!form.nome.trim() || isDuplicateFound) ? "text-gray-200 cursor-not-allowed" : "cursor-pointer text-gray-400 hover:text-primary"
                        )}>
                          <Calendar size={20} />
                          <input 
                            disabled={isDuplicateFound || !form.nome.trim()}
                            type="date"
                            className="sr-only"
                            value={form.dataNasc}
                            onChange={e => {
                              const isoDate = e.target.value;
                              setForm(prev => ({ ...prev, dataNasc: isoDate }));
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="label-polish">Contato <span className="text-[10px] font-normal text-gray-400">(opcional)</span></label>
                    <input 
                      disabled={isDuplicateFound || !form.nome.trim()}
                      className={cn(
                        "input-polish",
                        (!form.nome.trim() || isDuplicateFound) && "opacity-60 cursor-not-allowed bg-gray-50"
                      )}
                      title={!form.nome.trim() ? "Preencha o Nome Completo primeiro" : undefined}
                      placeholder="(11) 90000-0000"
                      value={form.contato}
                      onChange={handleContatoInput}
                    />
                  </div>
                  <div>
                    <label className="label-polish">E-mail <span className="text-[10px] font-normal text-gray-400">(opcional)</span></label>
                    <input 
                      disabled={isDuplicateFound || !form.nome.trim()}
                      className={cn(
                        "input-polish",
                        (!form.nome.trim() || isDuplicateFound) && "opacity-60 cursor-not-allowed bg-gray-50"
                      )}
                      title={!form.nome.trim() ? "Preencha o Nome Completo primeiro" : undefined}
                      type="email"
                      placeholder="exemplo@email.com"
                      value={form.email}
                      onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Footer Buttons Tab 1 */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-6">
                   <button onClick={handleLimpar} className="btn-polish-secondary w-full sm:flex-1">
                      <Eraser size={18} />
                      Limpar
                   </button>
                   <button onClick={handleAvancarTab1} disabled={loading} className="btn-polish-primary w-full sm:flex-1">
                      {loading && activeTab === 1 ? <Loader2 size={18} className="animate-spin" /> : null}
                      Avançar
                      <ChevronRight size={18} />
                   </button>
                </div>
              </motion.div>
            )}

            {activeTab === 2 && (
              <motion.div
                key="tab2"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                   <MapPin size={20} className="text-[#1A3AAB]" />
                   <h2 className="text-lg font-black text-gray-800">Localização</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative sm:col-span-2">
                    <label className="label-polish">CEP <span className="text-[10px] font-normal text-gray-400">(opcional)</span></label>
                    <div className="relative">
                      <input 
                        className="input-polish"
                        placeholder="00000-000"
                        value={form.cep}
                        onChange={handleCepChange}
                      />
                      {cepLoading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <Loader2 size={18} className="animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label-polish">Logradouro</label>
                    <input 
                      className="input-polish"
                      placeholder="Rua, Avenida..."
                      value={form.logradouro}
                      onChange={e => setForm(prev => ({ ...prev, logradouro: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label-polish">Nº</label>
                    <input 
                      ref={inputNumeroRef}
                      className="input-polish"
                      placeholder="123"
                      value={form.numero}
                      onChange={e => setForm(prev => ({ ...prev, numero: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label-polish">Bairro</label>
                    <input 
                      className="input-polish"
                      placeholder="Bairro"
                      value={form.bairro}
                      onChange={e => setForm(prev => ({ ...prev, bairro: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label-polish">Cidade</label>
                    <input 
                      className="input-polish"
                      placeholder="Cidade"
                      value={form.cidade}
                      onChange={e => setForm(prev => ({ ...prev, cidade: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label-polish">UF</label>
                    <select 
                      className="input-polish appearance-none"
                      value={form.estado}
                      onChange={e => setForm(prev => ({ ...prev, estado: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      <option value="SP">SP</option>
                      <option value="RJ">RJ</option>
                      <option value="MG">MG</option>
                      <option value="PR">PR</option>
                      <option value="SC">SC</option>
                      <option value="RS">RS</option>
                    </select>
                  </div>
                </div>

                {/* Footer Buttons Tab 2 */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-6">
                   <button onClick={() => setActiveTab(1)} className="btn-polish-secondary w-full sm:flex-1">
                      <ChevronLeft size={18} />
                      Voltar
                   </button>
                   <button onClick={() => setActiveTab(3)} className="btn-polish-primary w-full sm:flex-1">
                      Avançar
                      <ChevronRight size={18} />
                   </button>
                </div>
              </motion.div>
            )}

            {activeTab === 3 && (
              <motion.div
                key="tab3"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                   <Home size={20} className="text-[#1A3AAB]" />
                   <h2 className="text-lg font-black text-gray-800">Dados Domiciliares</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-polish">Qtd. Moradores <span className="text-[10px] font-normal text-gray-400">(opcional)</span></label>
                    <input 
                      type="number"
                      className="input-polish"
                      placeholder="0"
                      value={form.moradores}
                      onChange={e => setForm(prev => ({ ...prev, moradores: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label-polish">Qtd. Adultos <span className="text-[10px] font-normal text-gray-400">(opcional)</span></label>
                    <input 
                      type="number"
                      className="input-polish"
                      placeholder="0"
                      value={form.adultos}
                      onChange={e => setForm(prev => ({ ...prev, adultos: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label-polish">Interesse <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select 
                        className="input-polish appearance-none pr-10"
                        value={form.interesse}
                        onChange={e => setForm(prev => ({ ...prev, interesse: e.target.value }))}
                      >
                        <option value="">Selecione a categoria...</option>
                        <option value="MUNÍCIPE">MUNÍCIPE</option>
                        <option value="IURD">IURD</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <ChevronRight size={18} className="rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons Tab 3 */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-6">
                   <button onClick={() => setActiveTab(2)} className="btn-polish-secondary w-full sm:flex-1">
                      <ChevronLeft size={18} />
                      Voltar
                   </button>
                   
                   <div className="flex w-full sm:flex-[2] gap-3">
                     {isEditing ? (
                       <>
                         <button onClick={handleEditar} disabled={loading} className="btn-green flex-1">
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Edit size={18} />}
                            Atualizar
                         </button>
                         <button onClick={handleExcluir} className="w-[52px] h-[52px] flex items-center justify-center bg-[#FFE8E8] text-[#FF4D4D] rounded-xl hover:bg-[#FFD1D1] transition-colors shadow-sm">
                            <Trash2 size={22} />
                         </button>
                       </>
                     ) : (
                       <button onClick={handleSalvar} disabled={loading} className="btn-green flex-1">
                          {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                          Salvar
                       </button>
                     )}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Status / Snackbar */}
      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[150] w-[90%] sm:w-auto sm:min-w-[400px]"
          >
            <div className={cn(
              "p-4 rounded-2xl flex items-center justify-center gap-3 shadow-2xl border text-sm font-black uppercase tracking-wider min-h-[64px]",
              status.tipo === 'success' && "bg-[#10B981] text-white border-green-200/20",
              status.tipo === 'error' && "bg-[#EF4444] text-white border-red-200/20",
              status.tipo === 'warning' && "bg-[#F59E0B] text-white border-amber-200/20",
              status.tipo === 'info' && "bg-[#3B82F6] text-white border-blue-200/20"
            )}>
              {status.tipo === 'success' && <CheckCircle2 size={24} />}
              {status.tipo === 'error' && <XCircle size={24} />}
              {status.tipo === 'warning' && <AlertCircle size={24} />}
              {status.tipo === 'info' && <Info size={24} />}
              <span className="flex-1 text-center">{status.msg}</span>
              <button onClick={() => setStatus(null)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
                <XCircle size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {isAdminModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-800">Gerenciar Usuários</h3>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Configurações de Acesso</p>
                  </div>
                </div>
                <button onClick={() => { setIsAdminModalOpen(false); setSelectedUserForReset(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <XCircle size={24} />
                </button>
              </div>

              {adminLoading && !selectedUserForReset? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={32} className="text-primary animate-spin mb-2" />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Carregando...</span>
                </div>
              ) : selectedUserForReset ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-xs font-bold text-amber-800 mb-1">REDEFINIR SENHA PARA:</p>
                    <p className="text-sm font-black text-amber-900 uppercase">{selectedUserForReset.nome} ({selectedUserForReset.username})</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Nova Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text"
                        className="input-polish !pl-12"
                        placeholder="Digite a nova senha"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => { setSelectedUserForReset(null); setNewPassword(''); }}
                      className="flex-1 btn-polish-secondary"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleUpdatePassword}
                      disabled={adminLoading || !newPassword.trim()}
                      className="flex-1 btn-polish-primary"
                    >
                      {adminLoading ? <Loader2 size={18} className="animate-spin" /> : "Salvar Senha"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  {userList.map((u) => (
                    <div key={u.username} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-sm font-black text-gray-800 uppercase leading-none">{u.nome}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1">{u.username.toLowerCase()} • {u.perfil}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedUserForReset(u)}
                        className="text-[10px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-all active:scale-95"
                      >
                        Redefinir Senha
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {showConfirmDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-border"
            >
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-text-main mb-2">Confirmar Exclusão</h3>
              <p className="text-sm text-text-muted mb-8">
                Tem certeza que deseja excluir o cadastro de <span className="font-bold text-text-main">"{form.nome}"</span>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirmDelete(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg font-bold text-sm text-text-muted hover:bg-bg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmExcluir}
                  className="flex-1 px-4 py-2.5 rounded-lg font-bold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
