import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-primary/10 text-primary';
    case 'in_progress': return 'bg-warning/10 text-warning';
    case 'resolved': return 'bg-success/10 text-success';
    case 'closed': return 'bg-muted text-muted-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};

const ticketCategories = ['General', 'Payment Issue', 'Refund Request', 'Dispute Help', 'Account Issue', 'Other'];

export default function MerchantSupport() {
  const { merchant, user } = useMerchantAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [orderId, setOrderId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!merchant?.id) return;

    const fetchTickets = async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching merchant tickets:', error);
        toast({ title: 'Error', description: 'Failed to load tickets', variant: 'destructive' });
      } else {
        setTickets(data || []);
      }
      setIsLoading(false);
    };

    fetchTickets();

    const channel = supabase
      .channel('merchant-support-tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `merchant_id=eq.${merchant.id}`,
        },
        () => fetchTickets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchant?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant?.id || !user?.id) return;

    if (!subject.trim()) {
      toast({ title: 'Error', description: 'Please enter a subject', variant: 'destructive' });
      return;
    }
    if (!description.trim()) {
      toast({ title: 'Error', description: 'Please describe your issue', variant: 'destructive' });
      return;
    }
    if (subject.length > 200) {
      toast({ title: 'Error', description: 'Subject is too long (max 200 characters)', variant: 'destructive' });
      return;
    }
    if (description.length > 2000) {
      toast({ title: 'Error', description: 'Description is too long (max 2000 characters)', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          customer_id: user.id,
          merchant_id: merchant.id,
          subject: subject.trim(),
          category: category.toLowerCase().replace(' ', '_'),
          description: description.trim(),
          order_id: orderId.trim() || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_type: 'merchant',
        sender_name: merchant.businessName || 'Merchant',
        message: description.trim(),
      });

      toast({ title: 'Ticket Submitted', description: 'Our team will get back to you soon!' });
      setSubject('');
      setCategory('General');
      setDescription('');
      setOrderId('');
      setShowForm(false);
    } catch (error) {
      console.error('Error submitting ticket:', error);
      toast({ title: 'Error', description: 'Failed to submit ticket. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mobile-page">
      <header className="sticky-header bg-card">
        <div className="sticky-header-content px-4 sm:px-6">
          <button onClick={() => navigate('/merchant-dashboard')} className="back-btn">
            <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-foreground">Help & Support</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Merchant support tickets</p>
          </div>
          <Button size="sm" onClick={() => setShowForm(true)} className="h-8 text-xs px-3 rounded-lg shrink-0">
            <span className="material-symbols-outlined text-sm mr-1">add_circle</span>
            New
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto mobile-section pb-24 space-y-4">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/merchant-refunds"
            className="flex items-center gap-3 p-3.5 bg-card rounded-xl border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-success text-lg">currency_rupee</span>
            </div>
            <div className="text-left min-w-0">
              <p className="font-medium text-foreground text-xs">View Refunds</p>
              <p className="text-[10px] text-muted-foreground">Check refund status</p>
            </div>
          </Link>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-3 p-3.5 bg-card rounded-xl border border-border hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">add_circle</span>
            </div>
            <div className="text-left min-w-0">
              <p className="font-medium text-foreground text-xs">New Ticket</p>
              <p className="text-[10px] text-muted-foreground">Get help</p>
            </div>
          </button>
        </div>

        {/* My tickets */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">My Tickets</h2>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tickets.length > 0 ? (
            <div className="space-y-2">
              {tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/merchant-support/${ticket.id}`}
                  className="block p-4 bg-card rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-1">
                        {ticket.category.replace('_', ' ')} • {format(new Date(ticket.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize shrink-0 ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-card border border-border rounded-xl">
              <span className="material-symbols-outlined text-muted-foreground text-3xl">confirmation_number</span>
              <p className="text-foreground font-medium text-sm mt-2">No tickets yet</p>
              <p className="text-muted-foreground text-xs mb-4">Create a ticket to get help</p>
              <Button size="sm" onClick={() => setShowForm(true)} className="rounded-xl">
                Create Ticket
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Create ticket modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-card w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border-t sm:border border-border p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Create Support Ticket</h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-muted-foreground">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Subject</label>
                <Input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  maxLength={200}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-muted border-0 text-foreground focus:ring-2 focus:ring-primary"
                >
                  {ticketCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Order ID (Optional)</label>
                <Input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Reference order for this ticket"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe your issue in detail..."
                  rows={4}
                  maxLength={2000}
                  required
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{description.length}/2000</p>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !subject.trim() || !description.trim()}
                className="w-full h-12 rounded-xl"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Submit Ticket'
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
