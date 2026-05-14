import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Receipt,
  Ticket,
  User,
  ChevronLeft,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';

/** Menu utama (tanpa sheet Akun — keluar dari halaman Profil). */
const NAV_ITEMS = [
  { key: 'home', label: 'Beranda', to: '/dashboard', icon: LayoutDashboard },
  { key: 'package', label: 'Paket', to: '/paket', icon: Package },
  { key: 'billing', label: 'Tagihan', to: '/tagihan', icon: Receipt },
  { key: 'tiket', label: 'Gangguan', to: '/tiket', icon: Ticket },
  { key: 'profile', label: 'Profil', to: '/profil', icon: User },
];

function pathActive(pathname, to) {
  if (!to) return false;
  if (pathname === to) return true;
  return pathname.startsWith(`${to}/`);
}

export default function PortalLayout() {
  const [branding, setBranding] = useState({ logo_url: '', company_name: '', company_header: '' });
  const [logoFailed, setLogoFailed] = useState(false);
  const customer = useAuthStore((s) => s.customer);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const linkClassDesktop = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isActive
        ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-sm'
        : 'text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent'
    }`;

  useEffect(() => {
    let cancelled = false;
    api
      .get('/settings/branding')
      .then((res) => {
        if (cancelled || !res.data?.success) return;
        setBranding({
          logo_url: res.data.logo_url || '',
          company_name: res.data.company_name || '',
          company_header: res.data.company_header || '',
        });
        setLogoFailed(false);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const isHomeDashboard = pathname === '/dashboard' || pathname === '/';
  const displayName = branding.company_header || branding.company_name || 'ISP';

  const handleBack = () => {
    if (isHomeDashboard) return;
    navigate(-1);
  };

  return (
    <div className="min-h-[100dvh] min-h-screen bg-gradient-to-b from-sky-50/80 via-white to-slate-50 flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200/90 bg-white/90 backdrop-blur-xl shadow-soft">
        <div className="p-5 border-b border-slate-100">
          <p className="text-[11px] uppercase tracking-wider text-sky-600 font-semibold">Portal pelanggan</p>
          <p className="mt-1 font-semibold text-slate-900 truncate text-base">{customer?.name || 'Pelanggan'}</p>
          <p className="text-xs text-slate-500 truncate">{customer?.username}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.key} to={item.to} className={linkClassDesktop} title={item.key === 'tiket' ? 'Lapor gangguan' : undefined}>
                <Icon className="w-5 h-5 shrink-0 text-sky-600/80" />
                {item.key === 'tiket' ? 'Lapor gangguan' : item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 safe-pt border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-sm">
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] sm:grid-cols-[4.25rem_minmax(0,1fr)_4.25rem] items-center min-h-[4.75rem] sm:min-h-[5.75rem] px-2 sm:px-4 lg:px-6 py-1">
            <div className="flex justify-start items-center">
              <button
                type="button"
                onClick={handleBack}
                disabled={isHomeDashboard}
                aria-label="Kembali"
                className={`touch-target flex items-center justify-center rounded-2xl border transition-colors ${
                  isHomeDashboard
                    ? 'border-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                    : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                <ChevronLeft className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.25} />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center min-w-0 px-2 py-2">
              {!logoFailed && branding.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={displayName}
                  className="max-h-[3.25rem] sm:max-h-[3.75rem] md:max-h-[4rem] w-auto max-w-[min(100%,14rem)] object-contain object-center"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="text-center font-bold text-slate-800 text-base sm:text-lg leading-tight line-clamp-2">
                  {displayName}
                </span>
              )}
            </div>

            <div className="flex flex-col items-end justify-center min-w-0" aria-hidden="true" />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
          <Outlet />
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-nav safe-pb pt-1 flex justify-between items-stretch px-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.to}
                title={item.key === 'tiket' ? 'Lapor gangguan' : item.label}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 rounded-xl transition-colors ${
                    isActive ? 'text-sky-600' : 'text-slate-500 active:bg-slate-50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl mb-0.5 transition-colors ${
                        isActive ? 'bg-sky-100 text-sky-700' : 'bg-transparent'
                      }`}
                    >
                      <Icon className="w-[22px] h-[22px] sm:w-6 sm:h-6" strokeWidth={isActive ? 2.25 : 2} />
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold leading-tight text-center px-0.5">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
