import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

// Hanya route yang benar-benar ada di App.jsx
const NAV_ITEMS = [
  { path: '/',    icon: 'dashboard',    label: 'Dashboard' },
  { path: '/sesi', icon: 'folder_shared', label: 'Sessions',
    // aktif jika di halaman sesi manapun
    matchFn: (pathname) => pathname.startsWith('/sesi') },
];

export default function Navbar() {
  const { user, clearAuth } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <nav className="hidden md:flex bg-surface h-screen w-64 border-r border-border-dark
                    flex-col py-unit-8 shrink-0 z-10 fixed left-0 top-0">

      {/* Brand */}
      <div className="px-unit-4 mb-unit-8 flex items-center gap-unit-4">
        <div className="w-8 h-8 bg-primary-container rounded flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white" style={{fontSize:18}}>
            photo_camera
          </span>
        </div>
        <div>
          <span className="text-headline-md font-headline-md font-bold text-primary block leading-tight">
            CFC
          </span>
          <span className="text-mono-label font-mono-label text-on-surface-variant">
            Culling Foto Creative
          </span>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex flex-col gap-unit-1 px-unit-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const active = item.matchFn
            ? item.matchFn(location.pathname)
            : location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path === '/sesi' ? '/' : item.path}
              className={`flex items-center gap-unit-4 px-unit-4 py-3 transition-colors rounded
                ${active
                  ? 'text-primary font-bold border-r-2 border-primary bg-surface-container-high'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-text-primary'
                }`}
            >
              <span className="material-symbols-outlined"
                    style={{fontSize:20,
                      fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0"
                    }}>
                {item.icon}
              </span>
              <span className="text-label-sm font-label-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* User info + logout */}
      <div className="px-unit-4 pt-unit-4 border-t border-border-dark">
        {user && (
          <div className="flex items-center gap-unit-2 mb-unit-2">
            <div className="w-7 h-7 bg-surface-container-high rounded-full flex items-center
                            justify-center border border-border-dark shrink-0">
              <span className="material-symbols-outlined text-text-muted" style={{fontSize:14}}>
                person
              </span>
            </div>
            <span className="text-mono-label font-mono-label text-on-surface-variant truncate flex-1">
              {user.email}
            </span>
          </div>
        )}
        <button onClick={handleLogout}
          className="w-full flex items-center gap-unit-2 px-unit-2 py-2 text-on-surface-variant
                     hover:text-error hover:bg-surface-container transition-colors rounded">
          <span className="material-symbols-outlined" style={{fontSize:16}}>logout</span>
          <span className="text-label-sm font-label-sm">Sign Out</span>
        </button>
      </div>
    </nav>
  );
}
