import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    clearAuth();
    navigate('/login');
    setMobileMenuOpen(false);
  }

  function handleNavClick(path) {
    setMobileMenuOpen(false);
    navigate(path === '/sesi' ? '/' : path);
  }

  return (
    <>
      {/* Desktop Sidebar - tetap sama */}
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

    {/* Mobile Hamburger Button - Fixed di pojok kanan atas */}
    <button 
      onClick={() => setMobileMenuOpen(true)}
      className="md:hidden fixed top-3 right-3 z-40 w-12 h-12 flex items-center justify-center
                 bg-surface border border-border-dark rounded-full shadow-lg
                 active:scale-95 transition-transform"
      aria-label="Open menu">
      <span className="material-symbols-outlined text-text-primary" style={{fontSize:24}}>
        menu
      </span>
    </button>

    {/* Mobile Drawer */}
    {mobileMenuOpen && (
      <div className="md:hidden fixed inset-0 z-50 flex"
           onClick={() => setMobileMenuOpen(false)}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 animate-[fadeIn_0.2s_ease]" />
        
        {/* Drawer */}
        <nav className="relative w-72 h-full bg-surface border-r border-border-dark
                        flex flex-col py-6 animate-[slideRight_0.3s_ease]"
             onClick={(e) => e.stopPropagation()}>
          
          {/* Header dengan close button */}
          <div className="px-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-container rounded flex items-center justify-center">
                <span className="material-symbols-outlined text-white" style={{fontSize:18}}>
                  photo_camera
                </span>
              </div>
              <div>
                <span className="text-headline-md font-headline-md font-bold text-primary block leading-tight">
                  CFC
                </span>
                <span className="text-[10px] font-mono-label text-on-surface-variant">
                  Culling Foto Creative
                </span>
              </div>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full
                         hover:bg-surface-container-high active:scale-95 transition-all"
              aria-label="Close menu">
              <span className="material-symbols-outlined text-text-muted" style={{fontSize:24}}>
                close
              </span>
            </button>
          </div>

          {/* Nav links */}
          <div className="flex flex-col gap-1 px-2 flex-1">
            {NAV_ITEMS.map((item) => {
              const active = item.matchFn
                ? item.matchFn(location.pathname)
                : location.pathname === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  className={`flex items-center gap-4 px-4 py-4 transition-colors rounded
                              text-left min-h-[56px] active:scale-[0.98]
                    ${active
                      ? 'text-primary font-bold bg-surface-container-high'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-text-primary'
                    }`}
                >
                  <span className="material-symbols-outlined"
                        style={{fontSize:24,
                          fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0"
                        }}>
                    {item.icon}
                  </span>
                  <span className="text-body-md font-body-md">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* User info + logout */}
          <div className="px-4 pt-4 border-t border-border-dark">
            {user && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-surface-container rounded">
                <div className="w-9 h-9 bg-surface-container-high rounded-full flex items-center
                                justify-center border border-border-dark shrink-0">
                  <span className="material-symbols-outlined text-text-muted" style={{fontSize:18}}>
                    person
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-label-sm font-label-sm text-text-primary truncate">
                    {user.nama || 'Photographer'}
                  </p>
                  <p className="text-[11px] font-mono-label text-on-surface-variant truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
            <button onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-error
                         hover:bg-error/10 border border-error/30 rounded transition-colors
                         active:scale-[0.98] min-h-[48px]">
              <span className="material-symbols-outlined" style={{fontSize:20}}>logout</span>
              <span className="text-label-sm font-label-sm">Sign Out</span>
            </button>
          </div>
        </nav>
      </div>
    )}
  </>
  );
}
