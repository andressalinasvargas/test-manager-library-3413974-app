import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('role') || '');
  const [currentTab, setCurrentTab] = useState('books');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login Form State
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Books State
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [booksPage, setBooksPage] = useState(1);
  const [booksTotal, setBooksTotal] = useState(0);
  const [bookModal, setBookModal] = useState(null); // 'create' | book object for edit

  // Members State
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberModal, setMemberModal] = useState(false);
  const [newMember, setNewMember] = useState({ full_name: '', document_number: '' });

  // Loans State
  const [loans, setLoans] = useState([]);
  const [loanModal, setLoanModal] = useState(false);
  const [loanForm, setLoanForm] = useState({ member_id: '', items: ['', '', ''] });

  // Overdue State
  const [overdueList, setOverdueList] = useState([]);

  // Reports State
  const [reportDates, setReportDates] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [reportRows, setReportRows] = useState([]);

  // Auth fetch helper
  const apiFetch = async (endpoint, options = {}) => {
    setErrorMsg('');
    setSuccessMsg('');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        let msg = data?.message || `Error del servidor (${res.status})`;
        if (data?.details?.length) {
          msg += `: ${data.details.map(d => `${d.field}: ${d.issue}`).join(', ')}`;
        }
        throw new Error(msg);
      }
      return data;
    } catch (err) {
      setErrorMsg(err.message);
      throw err;
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });
      setToken(data.access_token);
      setUserRole(data.role);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      setSuccessMsg('Inicio de sesión exitoso');
    } catch (err) {
      // Error handled by apiFetch
    }
  };

  const handleLogout = () => {
    setToken('');
    setUserRole('');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
  };

  // Load Categories
  const loadCategories = async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/categories');
      if (Array.isArray(data)) setCategories(data);
    } catch (err) {}
  };

  // Load Books
  const loadBooks = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ page: booksPage, size: 10 });
      if (searchQuery) params.append('q', searchQuery);
      if (selectedCategory) params.append('category_id', selectedCategory);
      const data = await apiFetch(`/books?${params.toString()}`);
      if (data?.items) {
        setBooks(data.items);
        setBooksTotal(data.total);
      }
    } catch (err) {}
  };

  // Load Members
  const loadMembers = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ page: 1, size: 50 });
      if (memberSearch) params.append('q', memberSearch);
      const data = await apiFetch(`/members?${params.toString()}`);
      if (data?.items) setMembers(data.items);
    } catch (err) {}
  };

  // Load Loans
  const loadLoans = async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/loans?page=1&size=20');
      if (data?.items) setLoans(data.items);
    } catch (err) {}
  };

  // Load Overdue
  const loadOverdue = async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/loans/overdue?page=1&size=50');
      if (data?.items) setOverdueList(data.items);
    } catch (err) {}
  };

  // Load Reports
  const loadReports = async () => {
    if (!token || userRole !== 'admin') return;
    try {
      const data = await apiFetch(`/reports/most-borrowed?from=${reportDates.from}&to=${reportDates.to}`);
      if (data?.rows) setReportRows(data.rows);
    } catch (err) {}
  };

  useEffect(() => {
    if (token) {
      loadCategories();
      if (currentTab === 'books') loadBooks();
      if (currentTab === 'members') loadMembers();
      if (currentTab === 'loans') loadLoans();
      if (currentTab === 'overdue') loadOverdue();
      if (currentTab === 'reports') loadReports();
    }
  }, [token, currentTab, booksPage, searchQuery, selectedCategory]);

  // Book Handlers
  const handleSaveBook = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const bookData = {
      title: fd.get('title'),
      author: fd.get('author'),
      isbn: fd.get('isbn'),
      category_id: fd.get('category_id'),
      total_copies: parseInt(fd.get('total_copies'), 10)
    };

    try {
      if (bookModal === 'create') {
        await apiFetch('/books', { method: 'POST', body: JSON.stringify(bookData) });
        setSuccessMsg('Libro creado correctamente');
      } else {
        await apiFetch(`/books/${bookModal.id}`, { method: 'PUT', body: JSON.stringify(bookData) });
        setSuccessMsg('Libro actualizado correctamente');
      }
      setBookModal(null);
      loadBooks();
    } catch (err) {}
  };

  const handleDeleteBook = async (id) => {
    if (!window.confirm('¿Seguro de dar de baja este libro?')) return;
    try {
      await apiFetch(`/books/${id}`, { method: 'DELETE' });
      setSuccessMsg('Libro dado de baja (baja lógica aplicada)');
      loadBooks();
    } catch (err) {}
  };

  // Member Handlers
  const handleCreateMember = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/members', { method: 'POST', body: JSON.stringify(newMember) });
      setSuccessMsg('Socio registrado con éxito');
      setMemberModal(false);
      setNewMember({ full_name: '', document_number: '' });
      loadMembers();
    } catch (err) {}
  };

  // Loan Handlers
  const handleCreateLoan = async (e) => {
    e.preventDefault();
    const validBooks = loanForm.items.filter(id => id.trim() !== '').map(id => ({ book_id: id }));
    if (!validBooks.length) {
      setErrorMsg('Selecciona al menos un libro para prestar.');
      return;
    }

    try {
      await apiFetch('/loans', {
        method: 'POST',
        body: JSON.stringify({ member_id: loanForm.member_id, items: validBooks })
      });
      setSuccessMsg('Préstamo registrado exitosamente');
      setLoanModal(false);
      setLoanForm({ member_id: '', items: ['', '', ''] });
      loadLoans();
      loadBooks(); // refresh copies
    } catch (err) {}
  };

  const handleReturnItem = async (loanId, itemId) => {
    try {
      await apiFetch(`/loans/${loanId}/items/${itemId}/return`, { method: 'POST' });
      setSuccessMsg('Ejemplar devuelto exitosamente');
      loadLoans();
      if (currentTab === 'overdue') loadOverdue();
      loadBooks();
    } catch (err) {}
  };

  // Not logged in view
  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: '#fff', padding: '2.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', maxWidth: '420px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>Manager Library</h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Ficha ADSO 3413974 · Acceso al Sistema</p>
          </div>

          {errorMsg && (
            <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Usuario</label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                placeholder="ej. admin o bibliotecario"
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Contraseña</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••"
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }}
              />
            </div>
            <button
              type="submit"
              style={{ width: '100%', background: '#2563eb', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '6px', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>📚 Manager Library</span>
          <span style={{ background: userRole === 'admin' ? '#dbeafe' : '#f1f5f9', color: userRole === 'admin' ? '#1e40af' : '#475569', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
            {userRole.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Tabs Bar */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 2rem', display: 'flex', gap: '1.5rem' }}>
        {[
          { id: 'books', label: 'Catálogo de Libros (catalogo)' },
          { id: 'members', label: 'Socios (socios)' },
          { id: 'loans', label: 'Préstamos y Devolución (prestamo / devolucion)' },
          { id: 'overdue', label: 'Préstamos Vencidos (vencidos)' },
          ...(userRole === 'admin' ? [{ id: 'reports', label: 'Reporte Más Prestados (reporte)' }] : [])
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            style={{
              padding: '0.85rem 0.5rem',
              border: 'none',
              background: 'none',
              borderBottom: currentTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              color: currentTab === tab.id ? '#2563eb' : '#64748b',
              fontWeight: currentTab === tab.id ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Messages */}
      <div style={{ maxWidth: '1200px', margin: '1rem auto 0', width: '100%', padding: '0 1rem' }}>
        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {successMsg}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '1rem', flex: 1 }}>
        
        {/* BOOKS TAB */}
        {currentTab === 'books' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '300px' }}>
                <input
                  type="text"
                  placeholder="Buscar por título o autor..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
                />
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
                >
                  <option value="">Todas las Categorías</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {userRole === 'admin' && (
                <button
                  onClick={() => setBookModal('create')}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem' }}
                >
                  + Agregar Libro
                </button>
              )}
            </div>

            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem' }}>Título</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Autor</th>
                    <th style={{ padding: '0.75rem 1rem' }}>ISBN</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Categoría</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Disponibles</th>
                    {userRole === 'admin' && <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {books.length === 0 ? (
                    <tr>
                      <td colSpan={userRole === 'admin' ? 6 : 5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        No se encontraron libros en el catálogo.
                      </td>
                    </tr>
                  ) : (
                    books.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{b.title}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{b.author}</td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#64748b' }}>{b.isbn}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ background: '#f1f5f9', color: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                            {b.category?.name}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            fontWeight: 700,
                            color: b.available_copies > 0 ? '#16a34a' : '#dc2626',
                            background: b.available_copies > 0 ? '#f0fdf4' : '#fef2f2',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem'
                          }}>
                            {b.available_copies} / {b.total_copies}
                          </span>
                        </td>
                        {userRole === 'admin' && (
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <button
                              onClick={() => setBookModal(b)}
                              style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, marginRight: '0.75rem' }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteBook(b.id)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 600 }}
                            >
                              Baja
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MEMBERS TAB */}
        {currentTab === 'members' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem' }}>
              <input
                type="text"
                placeholder="Buscar socio por documento o nombre..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                style={{ flex: 1, maxWidth: '400px', padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
              />
              <button
                onClick={() => setMemberModal(true)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem' }}
              >
                + Registrar Socio
              </button>
            </div>

            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem' }}>Nombre Completo</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Documento</th>
                    <th style={{ padding: '0.75rem 1rem' }}>ID Único</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{m.full_name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569', fontFamily: 'monospace' }}>{m.document_number}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>{m.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOANS TAB */}
        {currentTab === 'loans' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Préstamos Activos y Devoluciones</h2>
              <button
                onClick={() => {
                  loadMembers();
                  loadBooks();
                  setLoanModal(true);
                }}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem' }}
              >
                + Nuevo Préstamo
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loans.map(loan => (
                <div key={loan.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Fecha: {new Date(loan.loaned_at).toLocaleDateString()}</span>
                      <span style={{ margin: '0 0.5rem', color: '#cbd5e1' }}>•</span>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Socio: {loan.member_id}</span>
                    </div>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: loan.status === 'open' ? '#dbeafe' : loan.status === 'overdue' ? '#fee2e2' : '#dcfce7',
                      color: loan.status === 'open' ? '#1e40af' : loan.status === 'overdue' ? '#991b1b' : '#166534'
                    }}>
                      {loan.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                    {loan.items?.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
                        <div>
                          <strong style={{ color: '#1e293b' }}>{item.book_title}</strong>
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>({item.category_name})</span>
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>Vence: {new Date(item.due_at).toLocaleDateString()}</span>
                        </div>
                        {item.returned_at ? (
                          <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>Devuelto ({new Date(item.returned_at).toLocaleDateString()})</span>
                        ) : (
                          <button
                            onClick={() => handleReturnItem(loan.id, item.id)}
                            style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#2563eb', padding: '0.3rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}
                          >
                            Registrar Devolución
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OVERDUE TAB */}
        {currentTab === 'overdue' && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Libros Vencidos y en Mora (HU-09)</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Líneas de préstamo que han superado los 14 días reglamentarios sin devolución.</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem' }}>Libro</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Socio</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Fecha de Vencimiento</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Días de Retraso</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        ¡Excelente! No hay libros vencidos en este momento.
                      </td>
                    </tr>
                  ) : (
                    overdueList.map(item => (
                      <tr key={item.item_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{item.book_title}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{item.member_name}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#dc2626' }}>{new Date(item.due_at).toLocaleDateString()}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem' }}>
                            {item.days_late} días
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleReturnItem(item.loan_id, item.item_id)}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}
                          >
                            Devolver
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {currentTab === 'reports' && userRole === 'admin' && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Libros Más Prestados (HU-10)</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Reporte agrupado por datos inmutables congelados en cada línea de préstamo.</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>Desde:</label>
                <input
                  type="date"
                  value={reportDates.from}
                  onChange={e => setReportDates({ ...reportDates, from: e.target.value })}
                  style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>Hasta:</label>
                <input
                  type="date"
                  value={reportDates.to}
                  onChange={e => setReportDates({ ...reportDates, to: e.target.value })}
                  style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>
              <button
                onClick={loadReports}
                style={{ marginTop: '1.2rem', background: '#2563eb', color: '#fff', border: 'none', padding: '0.45rem 1rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem' }}
              >
                Generar Reporte
              </button>
            </div>

            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem' }}>Título Congelado</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Categoría Congelada</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Préstamos Concedidos</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        No hay préstamos registrados en el rango seleccionado.
                      </td>
                    </tr>
                  ) : (
                    reportRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{row.book_title}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{row.category_name}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.6rem', borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem' }}>
                            {row.times_borrowed} veces
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* Book Modal */}
      {bookModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '500px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              {bookModal === 'create' ? 'Crear Nuevo Libro' : 'Editar Libro'}
            </h3>
            <form onSubmit={handleSaveBook}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Título</label>
                <input name="title" defaultValue={bookModal.title || ''} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Autor</label>
                <input name="author" defaultValue={bookModal.author || ''} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>ISBN (13 dígitos)</label>
                <input name="isbn" defaultValue={bookModal.isbn || ''} maxLength={13} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Categoría</label>
                <select name="category_id" defaultValue={bookModal.category?.id || categories[0]?.id} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Ejemplares Totales (>= 1)</label>
                <input name="total_copies" type="number" min={1} defaultValue={bookModal.total_copies || 1} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setBookModal(null)} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px' }}>Cancelar</button>
                <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 600 }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Modal */}
      {memberModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>Registrar Socio</h3>
            <form onSubmit={handleCreateMember}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nombre Completo</label>
                <input
                  required
                  value={newMember.full_name}
                  onChange={e => setNewMember({ ...newMember, full_name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Documento de Identidad (Único)</label>
                <input
                  required
                  value={newMember.document_number}
                  onChange={e => setNewMember({ ...newMember, document_number: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setMemberModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px' }}>Cancelar</button>
                <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 600 }}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan Modal */}
      {loanModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '550px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>Registrar Préstamo</h3>
            <form onSubmit={handleCreateLoan}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Socio Lector</label>
                <select
                  required
                  value={loanForm.member_id}
                  onChange={e => setLoanForm({ ...loanForm, member_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                >
                  <option value="">Selecciona un socio...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name} ({m.document_number})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Libros a Prestar (1 a 3 ejemplares)
                </label>
                {[0, 1, 2].map(idx => (
                  <div key={idx} style={{ marginBottom: '0.5rem' }}>
                    <select
                      value={loanForm.items[idx]}
                      onChange={e => {
                        const newItems = [...loanForm.items];
                        newItems[idx] = e.target.value;
                        setLoanForm({ ...loanForm, items: newItems });
                      }}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                    >
                      <option value="">{idx === 0 ? '-- Libro Obligatorio (1) --' : `-- Libro Opcional (${idx + 1}) --`}</option>
                      {books.filter(b => b.available_copies > 0).map(b => (
                        <option key={b.id} value={b.id}>{b.title} (Disp: {b.available_copies})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setLoanModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px' }}>Cancelar</button>
                <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 600 }}>Confirmar Préstamo</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

