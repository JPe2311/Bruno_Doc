'use client';
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Tipologia {
  id: string;
  name: string;
  active: boolean;
}

export default function AdminTipologiasPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tipologias, setTipologias] = useState<Tipologia[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'MEDICO')) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'MEDICO') return;
    loadTipologias();
  }, [user]);

  const loadTipologias = async () => {
    try {
      const q = collection(db, 'catalog_tables');
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Tipologia & { type: string }))
        .filter((t) => t.type === 'tipologia')
        .map(({ type, ...rest }) => rest as Tipologia);
      setTipologias(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addDoc(collection(db, 'catalog_tables'), {
        type: 'tipologia',
        name: newName.trim(),
        active: true,
      });
      setNewName('');
      toast.success('Tipologia agregada');
      loadTipologias();
    } catch (e) {
      console.error(e);
      toast.error('Error al agregar tipologia');
    }
  };

  const handleToggle = async (t: Tipologia) => {
    try {
      await updateDoc(doc(db, 'catalog_tables', t.id), { active: !t.active });
      loadTipologias();
    } catch (e) {
      console.error(e);
      toast.error('Error al actualizar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'catalog_tables', id));
      toast.success('Tipologia eliminada');
      loadTipologias();
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar role={user.role} />
      <main className="flex-1 p-6 max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Administrar Tipologias</h1>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Agregar Tipologia</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Nombre de la tipologia..."
              className="flex-1 rounded border border-slate-200 p-2.5 text-sm"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Listado de Tipologias</h2>
          {loading ? (
            <p className="text-slate-500">Cargando...</p>
          ) : tipologias.length === 0 ? (
            <p className="text-slate-500">No hay tipologias registradas</p>
          ) : (
            <div className="space-y-2">
              {tipologias.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${t.active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                      {t.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggle(t)}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        t.active
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {t.active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
