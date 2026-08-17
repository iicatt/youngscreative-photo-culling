import { useParams, Link }   from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Navbar    from '../components/common/Navbar';
import UploadZone from '../components/photographer/UploadZone';
import Spinner   from '../components/common/Spinner';
import api       from '../services/api';

export default function UploadPage() {
  const { sesiId }  = useParams();
  const queryClient = useQueryClient();

  const { data: sesi, isLoading } = useQuery({
    queryKey: ['sesi', sesiId],
    queryFn: () => api.get(`/sesi/${sesiId}`).then((r) => r.data),
  });

  function handleUploaded() {
    queryClient.invalidateQueries({ queryKey: ['foto', sesiId] });
    queryClient.invalidateQueries({ queryKey: ['sesi', sesiId] });
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Navbar />
      <main className="flex-1 md:ml-64 flex flex-col">

        <header className="md:hidden flex items-center px-4 h-14 border-b border-border-dark bg-surface">
          <span className="text-headline-lg-mobile font-headline-lg-mobile text-primary">CFC</span>
        </header>

        <div className="border-b border-border-dark bg-surface px-4 md:px-6 h-16
                        flex items-center gap-3 sticky top-0 z-30">
          <Link to={`/sesi/${sesiId}`}
            className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined" style={{fontSize:18}}>arrow_back</span>
          </Link>
          <div>
            <h1 className="text-headline-md font-headline-md text-text-primary leading-tight">
              Upload Photos
            </h1>
            {sesi && (
              <p className="text-mono-label font-mono-label text-on-surface-variant">
                {sesi.nama_sesi} · {sesi.nama_klien}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-3xl w-full mx-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size={28} /></div>
          ) : (
            <UploadZone sesiId={sesiId} onUploaded={handleUploaded} />
          )}
        </div>
      </main>
    </div>
  );
}
