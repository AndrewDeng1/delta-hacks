import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { TreePine, User, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-hero">
              <TreePine className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-gradient">Motion4Good</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {isAuthenticated && (
              <>
                <Link 
                  to="/challenges" 
                  className={`font-medium transition-colors ${isActive('/challenges') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Challenges
                </Link>
                <Link 
                  to="/my-challenges" 
                  className={`font-medium transition-colors ${isActive('/my-challenges') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  My Challenges
                </Link>
                <Link 
                  to="/create-challenge" 
                  className={`font-medium transition-colors ${isActive('/create-challenge') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Create
                </Link>
              </>
            )}
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link to="/profile">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    {user?.username}
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/signin">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link to="/signup">
                  <Button variant="hero" size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-slide-up">
            <div className="flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  <Link to="/challenges" className="px-4 py-2 rounded-lg hover:bg-muted">Challenges</Link>
                  <Link to="/my-challenges" className="px-4 py-2 rounded-lg hover:bg-muted">My Challenges</Link>
                  <Link to="/create-challenge" className="px-4 py-2 rounded-lg hover:bg-muted">Create</Link>
                  <Link to="/profile" className="px-4 py-2 rounded-lg hover:bg-muted">Profile</Link>
                  <button onClick={handleLogout} className="px-4 py-2 rounded-lg hover:bg-muted text-left text-destructive">Logout</button>
                </>
              ) : (
                <>
                  <Link to="/signin" className="px-4 py-2 rounded-lg hover:bg-muted">Sign In</Link>
                  <Link to="/signup"><Button variant="hero" className="w-full mt-2">Get Started</Button></Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
