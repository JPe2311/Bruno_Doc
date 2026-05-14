'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { Sidebar } from '@/components/layout/sidebar';
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
      const storageRef = ref(storage, `${type}s/${user.uid}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, 'users', user.uid), { [`${type}URL`]: url }, { merge: true });
      if (type === 'banner') setBannerURL(url);
      else setStampURL(url);
      toast.success(`${type === 'banner' ? 'Banner' : 'Sello'} actualizado correctamente`);
    } catch (err) {
      console.error(err);
      toast.error(`Error al subir ${type === 'banner' ? 'banner' : 'sello'}`);
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
      </main>
    </div>
  );
}
