import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { SafepayLogo } from '@/components/ui/SafepayLogo';
import { CreditCard, Hourglass, ReceiptText, Send, Settings, ShoppingCart, Wallet } from 'lucide-react';

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
          <div className="w-32">
            <SafepayLogo size="md" />
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
                <Wallet className="text-primary h-5 w-5" />
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
                <ShoppingCart className="text-success h-5 w-5" />
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
                <Hourglass className="text-warning h-5 w-5" />
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
              <CreditCard className="text-primary h-5 w-5" />
              <span className="text-sm">Add Money</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
              <Send className="text-primary h-5 w-5" />
              <span className="text-sm">Send Money</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
              <ReceiptText className="text-primary h-5 w-5" />
              <span className="text-sm">View Orders</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
              <Settings className="text-primary h-5 w-5" />
              <span className="text-sm">Settings</span>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
