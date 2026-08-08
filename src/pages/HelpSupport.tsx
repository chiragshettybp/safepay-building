import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
}

const faqs: FAQItem[] = [
  {
    category: 'Payments',
    question: 'How does SafePay payment work?',
    answer: 'When you make a payment, the funds are locked securely in SafePay. The merchant receives the money only after you confirm delivery of the product or service. This protects you from fraud and ensures you get what you paid for.',
  },
  {
    category: 'Payments',
    question: 'How long are funds locked in SafePay?',
    answer: 'Funds are held until you confirm delivery or a maximum of 14 days. If there\'s no confirmation, we\'ll reach out to both parties to resolve the transaction.',
  },
  {
    category: 'Refunds',
    question: 'How do I get a refund?',
    answer: 'If you haven\'t received your product or the product is not as described, you can raise a dispute from the order details page. Our team will review your case and process a refund if applicable.',
  },
  {
    category: 'Refunds',
    question: 'How long do refunds take?',
    answer: 'Once approved, refunds are typically processed within 3-5 business days. The time for the amount to reflect in your account depends on your bank.',
  },
  {
    category: 'Disputes',
    question: 'How do I raise a dispute?',
    answer: 'Go to your order details, click on "Report Issue" and follow the steps to submit your dispute. You\'ll need to provide details about the issue and any supporting evidence.',
  },
  {
    category: 'Disputes',
    question: 'What happens after I raise a dispute?',
    answer: 'Our team reviews the dispute, contacts both parties if needed, and makes a fair decision based on the evidence provided. You\'ll be notified of the outcome.',
  },
  {
    category: 'KYC',
    question: 'Why do I need to complete KYC?',
    answer: 'KYC (Know Your Customer) verification helps us ensure the security of all transactions and comply with regulations. It also enables higher transaction limits and faster refund processing.',
  },
  {
    category: 'KYC',
    question: 'What documents are required for KYC?',
    answer: 'You\'ll need a government-issued ID (Aadhaar, PAN, Passport, or Driving License) and a selfie for verification. Address proof may be required for higher verification levels.',
  },
  {
    category: 'Account',
    question: 'How do I change my password?',
    answer: 'Go to Profile > Security Settings > Change Password. You\'ll need to enter your current password and then set a new one.',
  },
  {
    category: 'Account',
    question: 'How do I add a bank account for withdrawals?',
    answer: 'Go to Wallet > Bank Accounts > Add Bank Account. Enter your account details and verify ownership. Once verified, you can withdraw funds to this account.',
  },
];

const categories = ['All', 'Payments', 'Refunds', 'Disputes', 'KYC', 'Account'];
const ticketCategories = ['General', 'Payment Issue', 'Refund Request', 'Dispute Help', 'Account Issue', 'Other'];

export default function HelpSupport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Ticket form state
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('General');
  const [ticketDescription, setTicketDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // User tickets
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchMyTickets();
      
      // Realtime subscription for ticket updates
      const channel = supabase
        .channel('support-tickets-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `customer_id=eq.${user.id}`
        }, () => fetchMyTickets())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoadingTickets(false);
    }
  }, [user?.id]);

  const fetchMyTickets = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setMyTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!ticketSubject.trim()) {
      toast({ title: 'Error', description: 'Please enter a subject', variant: 'destructive' });
      return;
    }
    if (!ticketDescription.trim()) {
      toast({ title: 'Error', description: 'Please describe your issue', variant: 'destructive' });
      return;
    }
    if (ticketSubject.length > 200) {
      toast({ title: 'Error', description: 'Subject is too long (max 200 characters)', variant: 'destructive' });
      return;
    }
    if (ticketDescription.length > 2000) {
      toast({ title: 'Error', description: 'Description is too long (max 2000 characters)', variant: 'destructive' });
      return;
    }
    if (!user?.id) {
      toast({ title: 'Error', description: 'Please login to submit a ticket', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: newTicket, error } = await supabase
        .from('support_tickets')
        .insert({
          customer_id: user.id,
          subject: ticketSubject.trim(),
          category: ticketCategory.toLowerCase().replace(' ', '_'),
          description: ticketDescription.trim(),
        })
        .select('id')
        .single();

      if (error) throw error;

      // Seed the conversation with the customer's initial message
      await supabase.from('ticket_messages').insert({
        ticket_id: newTicket.id,
        sender_id: user.id,
        sender_type: 'customer',
        sender_name: user.fullName || 'You',
        message: ticketDescription.trim(),
      });

      toast({
        title: 'Ticket Submitted',
        description: 'We\'ll get back to you soon!',
      });

      // Reset form
      setTicketSubject('');
      setTicketCategory('General');
      setTicketDescription('');
      setShowTicketForm(false);
      
      // Refresh tickets
      fetchMyTickets();
    } catch (error) {
      console.error('Error submitting ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit ticket. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-primary/10 text-primary';
      case 'in_progress': return 'bg-warning/10 text-warning';
      case 'resolved': return 'bg-success/10 text-success';
      case 'closed': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
            >
              <span className="material-symbols-outlined text-foreground">arrow_back</span>
            </button>
            <h1 className="text-lg font-semibold text-foreground">Help & Support</h1>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xl">
            search
          </span>
          <input
            type="text"
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-xl bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
            maxLength={100}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/disputes')}
            className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-600">gavel</span>
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground text-sm">View Disputes</p>
              <p className="text-xs text-muted-foreground">Check status</p>
            </div>
          </button>
          <button
            onClick={() => setShowTicketForm(true)}
            className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">add_circle</span>
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground text-sm">New Ticket</p>
              <p className="text-xs text-muted-foreground">Get help</p>
            </div>
          </button>
        </div>
      </div>

      {/* My Tickets Section */}
      {user && (
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground">My Tickets</h2>
            {myTickets.length > 0 && (
              <button 
                onClick={() => setShowTicketForm(true)}
                className="text-xs text-primary font-medium"
              >
                + New Ticket
              </button>
            )}
          </div>
          
          {loadingTickets ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : myTickets.length > 0 ? (
            <div className="space-y-2">
              {myTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/help/tickets/${ticket.id}`}
                  className="block p-4 bg-card rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-1">
                        {ticket.category.replace('_', ' ')} • {format(new Date(ticket.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-card border border-border rounded-xl">
              <span className="material-symbols-outlined text-muted-foreground text-3xl">confirmation_number</span>
              <p className="text-foreground font-medium text-sm mt-2">No tickets yet</p>
              <p className="text-muted-foreground text-xs mb-4">Create a ticket to get help</p>
              <Button size="sm" onClick={() => setShowTicketForm(true)} className="rounded-xl">
                Create Ticket
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Contact Options */}
      <div className="px-4 py-4 border-t border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Contact Us</h2>
        <div className="space-y-3">
          <a
            href="mailto:support@safepay.com"
            className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:bg-muted transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">mail</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Email Support</p>
              <p className="text-sm text-muted-foreground">support@safepay.com</p>
            </div>
            <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
          </a>
          <a
            href="tel:+911800123456"
            className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:bg-muted transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600">call</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Phone Support</p>
              <p className="text-sm text-muted-foreground">1800-123-456 (Toll Free)</p>
            </div>
            <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
          </a>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="px-4 py-4 border-t border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Frequently Asked Questions</h2>
        
        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ List */}
        <div className="space-y-2 mt-3">
          {filteredFAQs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No FAQs found matching your search.</p>
          ) : (
            filteredFAQs.map((faq, index) => (
              <div
                key={index}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <button
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="font-medium text-foreground pr-4">{faq.question}</span>
                  <span className={`material-symbols-outlined text-muted-foreground transition-transform ${
                    expandedIndex === index ? 'rotate-180' : ''
                  }`}>
                    expand_more
                  </span>
                </button>
                {expandedIndex === index && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom padding */}
      <div className="h-20" />

      {/* Ticket Form Modal */}
      {showTicketForm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-card w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border-t sm:border border-border p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Create Support Ticket</h2>
              <button
                onClick={() => setShowTicketForm(false)}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-muted-foreground">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitTicket} className="space-y-4">
              {/* Subject */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Subject</label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  className="w-full h-12 px-4 rounded-xl bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                  maxLength={200}
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Category</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-muted border-0 text-foreground focus:ring-2 focus:ring-primary"
                >
                  {ticketCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Please describe your issue in detail..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary resize-none"
                  maxLength={2000}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">
                  {ticketDescription.length}/2000
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !ticketSubject.trim() || !ticketDescription.trim()}
                className="w-full h-12 rounded-xl"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </span>
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