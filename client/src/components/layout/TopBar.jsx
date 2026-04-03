// Top bar — shows tenant name and user menu with logout.
// Sits above the main content area (to the right of the sidebar).
// Uses a simple state-driven popover instead of the Shadcn DropdownMenu
// (Base UI Menu.Trigger has compatibility issues with our setup).

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CircleUser, LogOut } from 'lucide-react';

const TopBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = async () => {
    setOpen(false);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  // Close the menu when clicking outside of it
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open]);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      {/* Tenant name */}
      <div className="text-sm font-medium text-muted-foreground">
        {user?.tenantName}
      </div>

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium
            text-foreground hover:bg-accent hover:text-accent-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          aria-haspopup="true"
        >
          <CircleUser className="size-5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {user?.firstName} {user?.lastName}
          </span>
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-md z-50"
            role="menu"
          >
            {/* User info */}
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>

            <div className="my-1 h-px bg-border" />

            {/* Sign out */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm
                hover:bg-accent hover:text-accent-foreground
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              role="menuitem"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopBar;
