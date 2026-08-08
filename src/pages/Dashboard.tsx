import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { SafepayLogo } from '@/components/ui/SafepayLogo';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/customer-login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="w-[100px]">
            <SafepayLogo />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground text-sm">
              {user?.phone}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back{user?.fullName ? `, ${user.fullName}` : ''}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's an overview of your account.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Wallet Balance</p>
                <p className="text-2xl font-bold text-foreground">₹0.00</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-success">shopping_cart</span>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Orders</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-warning">pending_actions</span>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Pending</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
              <span className="material-symbols-outlined text-primary">add_card</span>
              <span className="text-sm">Add Money</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
              <span className="material-symbols-outlined text-primary">send</span>
              <span className="text-sm">Send Money</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
              <span className="material-symbols-outlined text-primary">receipt_long</span>
              <span className="text-sm">View Orders</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
              <span className="material-symbols-outlined text-primary">settings</span>
              <span className="text-sm">Settings</span>
            </Button>
          </div>
        </div>
      </main>

      {/* Material Icons */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    </div>
  );
}
