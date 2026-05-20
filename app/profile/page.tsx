'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [bannerURL, setBannerURL] = useState('');
  const [stampURL, setStampURL] = useState('');
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', address: '', dni: '', obraSocial: '',
  });
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicMaps, setClinicMaps] = useState('');
  const [authorizedUsers, setAuthorizedUsers] = useState<Array<{ uid: string; fullName: string; dni: string }>>([]);
  const [showAddAuthModal, setShowAddAuthModal] = useState(false);
  const [searchDni, setSearchDni] = useState('');
  const [searchedPatient, setSearchedPatient] = useState<{ uid: string; fullName: string; dni: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [addingAuth, setAddingAuth] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        dni: user.dni || '',
        obraSocial: user.obraSocial || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchAssets = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.bannerURL) setBannerURL(data.bannerURL);
        if (data.stampURL) setStampURL(data.stampURL);
        if (data.clinicAddress) setClinicAddress(data.clinicAddress);
        if (data.clinicMaps) setClinicMaps(data.clinicMaps);
        if (data.authorizedUsers) {
          const authUsers: Array<{ uid: string; fullName: string; dni: string }> = [];
          for (const uid of data.authorizedUsers) {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              authUsers.push({ uid, fullName: userSnap.data().fullName || '', dni: userSnap.data().dni || '' });
            }
          }
          setAuthorizedUsers(authUsers);
        }
      }
    };
    fetchAssets();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    try {
      const updateData: Record<string, string> = { ...form };
      if (user.role === 'MEDICO') {
        updateData.clinicAddress = clinicAddress;
        updateData.clinicMaps = clinicMaps;
      }
      await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });
      toast.success('Perfil actualizado correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file: File, type: 'banner' | 'stamp') => {
    if (!user) return;
    const setUploading = type === 'banner' ? setUploadingBanner : setUploadingStamp;
    setUploading(true);
    try {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo debe ser menor a 5MB');
        setUploading(false);
        return;
      }
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Solo se permiten archivos PNG, JPEG o WebP');
        setUploading(false);
        return;
      }
      const storageRef = ref(storage, `users/${user.uid}/${type}s/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, 'users', user.uid), { [`${type}URL`]: url }, { merge: true });
      if (type === 'banner') setBannerURL(url);
      else setStampURL(url);
      toast.success(`${type === 'banner' ? 'Banner' : 'Sello'} actualizado correctamente`);
    } catch (err: unknown) {
      console.error('Upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al subir ${type === 'banner' ? 'banner' : 'sello'}: ${errorMessage}`);
    } finally {
      setUploading(false);
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
        <h1 className="text-2xl font-bold text-slate-900">Mi Perfil</h1>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Nombre completo</span>
              <input name="fullName" value={form.fullName} onChange={handleChange} required className="w-full rounded border border-slate-200 p-2.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">DNI</span>
              <input name="dni" value={form.dni} onChange={handleChange} required className="w-full rounded border border-slate-200 p-2.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Telefono</span>
              <input name="phone" value={form.phone} onChange={handleChange} required type="tel" className="w-full rounded border border-slate-200 p-2.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input name="email" value={form.email} onChange={handleChange} required type="email" className="w-full rounded border border-slate-200 p-2.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Obra Social</span>
              <input name="obraSocial" value={form.obraSocial} onChange={handleChange} className="w-full rounded border border-slate-200 p-2.5 text-sm" />
            </label>
          </div>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Direccion</span>
            <input name="address" value={form.address} onChange={handleChange} required className="w-full rounded border border-slate-200 p-2.5 text-sm" />
          </label>
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>

        {user.role === 'PACIENTE' && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Terceros Autorizados</h2>
              <button onClick={() => setShowAddAuthModal(true)} className="text-sm text-blue-600 font-medium hover:underline">
                + Agregar
              </button>
            </div>
            <p className="text-sm text-slate-500">Personas autorizadas para solicitar turnos a tu nombre.</p>
            {authorizedUsers.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No hay terceros autorizados agregados.</p>
            ) : (
              <ul className="space-y-2">
                {authorizedUsers.map(u => (
                  <li key={u.uid} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{u.fullName}</p>
                      <p className="text-xs text-slate-500">{u.dni || 'Sin DNI'}</p>
                    </div>
                    <button
                      onClick={async () => {
                        const newAuth = authorizedUsers.filter(a => a.uid !== u.uid).map(a => a.uid);
                        await setDoc(doc(db, 'users', user.uid), { authorizedUsers: newAuth }, { merge: true });
                        setAuthorizedUsers(authorizedUsers.filter(a => a.uid !== u.uid));
                        toast.success('Autorización removida');
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {(user.role === 'MEDICO' || (user as { role?: string }).role === 'MEDICO') && (
          <>
            <div className="card space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Banner del Reporte</h2>
              <p className="text-sm text-slate-500">Sube una imagen PNG que aparecera como banner en los reportes de atencion.</p>
              {bannerURL && (
                <img src={bannerURL} alt="Banner actual" className="w-full h-auto max-h-32 object-contain rounded border" />
              )}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Seleccionar archivo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, 'banner');
                  }}
                  className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
              </label>
              {uploadingBanner && <p className="text-sm text-sky-600">Subiendo banner...</p>}
            </div>

            <div className="card space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Sello / Firma Digital</h2>
              <p className="text-sm text-slate-500">Sube una imagen PNG de tu sello o firma que aparecera en los reportes.</p>
              {stampURL && (
                <div className="flex justify-center">
                  <img src={stampURL} alt="Sello actual" className="h-24 object-contain rounded border" />
                </div>
              )}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Seleccionar archivo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, 'stamp');
                  }}
                  className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
              </label>
              {uploadingStamp && <p className="text-sm text-sky-600">Subiendo sello...</p>}
            </div>

            <div className="card space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Datos del Consultorio</h2>
              <p className="text-sm text-slate-500">Estos datos se usaran para confirmar las citas por WhatsApp.</p>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Direccion del consultorio</span>
                <input
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  placeholder="Ej: Av. Principal 123, Buenos Aires"
                  className="w-full rounded border border-slate-200 p-2.5 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Link de Google Maps</span>
                <input
                  value={clinicMaps}
                  onChange={(e) => setClinicMaps(e.target.value)}
                  placeholder="Ej: https://goo.gl/maps/xxxxx"
                  className="w-full rounded border border-slate-200 p-2.5 text-sm"
                />
              </label>
            </div>
          </>
        )}

        {showAddAuthModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Agregar Tercer Autorizado</h3>
              <p className="text-sm text-slate-600 mb-4">Ingresa el DNI del paciente que deseas autorizar para solicitar turnos a tu nombre.</p>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Ingrese DNI"
                  value={searchDni}
                  onChange={(e) => { setSearchDni(e.target.value); setSearchedPatient(null); }}
                  className="flex-1 border border-slate-200 rounded-lg p-3"
                />
                <button
                  onClick={async () => {
                    if (!searchDni.trim()) {
                      toast.error('Ingrese un DNI');
                      return;
                    }
                    setSearching(true);
                    try {
                      const q = query(collection(db, 'users'), where('dni', '==', searchDni.trim()), where('role', '==', 'PACIENTE'));
                      const snap = await getDocs(q);
                      if (snap.empty) {
                        toast.error('No se encontró paciente con ese DNI');
                        setSearchedPatient(null);
                      } else {
                        const doc = snap.docs[0];
                        if (doc.id === user.uid) {
                          toast.error('No puede autorizarse a sí mismo');
                          setSearchedPatient(null);
                        } else if (authorizedUsers.some(a => a.uid === doc.id)) {
                          toast.error('Este paciente ya está autorizado');
                          setSearchedPatient(null);
                        } else {
                          setSearchedPatient({ uid: doc.id, fullName: doc.data().fullName || '', dni: doc.data().dni || '' });
                        }
                      }
                    } catch (err) {
                      console.error(err);
                      toast.error('Error al buscar paciente');
                    } finally {
                      setSearching(false);
                    }
                  }}
                  disabled={searching}
                  className="btn-secondary !py-2 !px-4"
                >
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              
              {searchedPatient && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <p className="text-sm font-medium text-green-800">Paciente encontrado:</p>
                  <p className="text-sm text-green-700">{searchedPatient.fullName} (DNI: {searchedPatient.dni})</p>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAddAuthModal(false); setSearchDni(''); setSearchedPatient(null); }}
                  className="flex-1 btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!searchedPatient) {
                      toast.error('Busque un paciente primero');
                      return;
                    }
                    setAddingAuth(true);
                    try {
                      const currentAuth = authorizedUsers.map(a => a.uid);
                      const newAuth = [...currentAuth, searchedPatient.uid];
                      await setDoc(doc(db, 'users', user.uid), { authorizedUsers: newAuth }, { merge: true });
                      setAuthorizedUsers([...authorizedUsers, searchedPatient]);
                      setShowAddAuthModal(false);
                      setSearchDni('');
                      setSearchedPatient(null);
                      toast.success('Tercer autorizado agregado');
                    } catch (err) {
                      console.error(err);
                      toast.error('Error al agregar autorización');
                    } finally {
                      setAddingAuth(false);
                    }
                  }}
                  disabled={addingAuth || !searchedPatient}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {addingAuth ? 'Agregando...' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
