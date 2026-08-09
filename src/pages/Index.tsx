import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SafepayLogo } from '@/components/ui/SafepayLogo';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Lock, CheckCircle, ArrowRight, AlertTriangle, Zap, Eye, Users, X, Check, ChevronRight, Star, ShieldCheck, Clock, Wallet, RefreshCw, MessageSquare, Ban, Menu } from 'lucide-react';
import { useState } from 'react';

const Index = () => {
  const { isAuthenticated, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <nav className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="w-20 sm:w-28">
            <SafepayLogo />
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            <a href="#problem" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Why Safepay</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button size="sm" className="h-9 rounded-full px-4 sm:px-5 text-xs sm:text-sm">
                  Dashboard
                  <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/customer-login" className="hidden sm:block">
                  <Button variant="ghost" size="sm" className="h-9 text-sm">
                    Log In
                  </Button>
                </Link>
                <Link to="/customer-signup">
                  <Button size="sm" className="h-9 rounded-full px-4 sm:px-5 text-xs sm:text-sm">
                    Get Started
                  </Button>
                </Link>
                
                {/* Mobile Menu Toggle */}
                <button 
                  className="md:hidden p-2 -mr-2 text-muted-foreground"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Toggle menu"
                  aria-expanded={mobileMenuOpen}
                >
                  <Menu className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </nav>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-background border-t border-border/50 px-4 py-4 space-y-3 animate-fade-in">
            <a 
              href="#problem" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Why Safepay
            </a>
            <a 
              href="#how-it-works" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </a>
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <Link 
              to="/customer-login"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-foreground font-medium"
            >
              Log In
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-12 sm:pt-32 sm:pb-20 md:pt-40 md:pb-32 px-4 sm:px-6">
        {/* Background Effects - simplified on mobile */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 -left-20 sm:-left-40 w-48 sm:w-80 h-48 sm:h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-40 -right-20 sm:-right-40 w-56 sm:w-96 h-56 sm:h-96 bg-success/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-success/10 border border-success/20 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-6 sm:mb-8 opacity-0 animate-fade-in" style={{ animationDelay: '0.05s' }}>
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />
            <span className="text-xs sm:text-sm font-medium text-success">SafePay Protection for Every Transaction</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground tracking-tight leading-[1.15] sm:leading-[1.1] mb-4 sm:mb-6 opacity-0 animate-fade-in-up px-2" style={{ animationDelay: '0.12s' }}>
            Stop Paying Strangers.<br />
            <span className="text-primary">Start Paying Safe.</span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl sm:max-w-2xl mx-auto mb-8 sm:mb-10 opacity-0 animate-fade-in-up px-2" style={{ animationDelay: '0.22s' }}>
            When you pay through Safepay, your money is <span className="text-foreground font-medium">locked in SafePay</span> until you receive what you paid for. No delivery? <span className="text-foreground font-medium">Full refund.</span>
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center mb-8 sm:mb-12 opacity-0 animate-fade-in-up px-4 sm:px-0" style={{ animationDelay: '0.32s' }}>
            {isAuthenticated ? (
              <Link to="/dashboard" className="w-full sm:w-auto">
                <Button size="lg" className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base rounded-full w-full group">
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/customer-signup" className="w-full sm:w-auto">
                  <Button size="lg" className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base rounded-full w-full group">
                    Create Free Account
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="#how-it-works" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base rounded-full w-full">
                    See How It Works
                  </Button>
                </a>
              </>
            )}
          </div>

          {/* Social Proof */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground opacity-0 animate-fade-in" style={{ animationDelay: '0.42s' }}>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />
              <span>Free for buyers</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />
              <span>Works with any seller</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="py-12 sm:py-16 md:py-28 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <span className="inline-block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-destructive bg-destructive/10 px-2.5 sm:px-3 py-1 rounded-full mb-3 sm:mb-4">
              The Problem
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6 px-2">
              Online Payments Are Broken
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl sm:max-w-2xl mx-auto px-2">
              Every time you pay an unknown seller, you're gambling with your money.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-3 mb-8 sm:mb-12 md:mb-16">
            {[
              {
                icon: AlertTriangle,
                title: "Pay First, Pray Later",
                desc: "Traditional payments require you to trust a stranger with your money before seeing the product."
              },
              {
                icon: Ban,
                title: "No Recourse",
                desc: "When things go wrong, getting your money back is nearly impossible. Banks don't help with disputes."
              },
              {
                icon: Users,
                title: "Fake Seller Profiles",
                desc: "Instagram shops, WhatsApp sellers, unknown websites — anyone can pretend to be legitimate."
              }
            ].map((item, i) => (
              <div
                key={i}
                className="bg-background border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-destructive/10 flex items-center justify-center mb-3 sm:mb-4">
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
                </div>
                <h3 className="font-bold text-foreground mb-1.5 sm:mb-2 text-sm sm:text-base">{item.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="bg-gradient-to-br from-destructive/5 to-destructive/10 border border-destructive/20 rounded-xl sm:rounded-2xl p-5 sm:p-8 text-center">
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2">
              ₹1,50,000+ Crores
            </p>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">Lost to online payment fraud in India annually</p>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-12 sm:py-16 md:py-28 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <span className="inline-block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-success bg-success/10 px-2.5 sm:px-3 py-1 rounded-full mb-3 sm:mb-4">
              The Solution
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6 px-2">
              Safepay Changes Everything
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl sm:max-w-2xl mx-auto px-2">
              Your payment is held securely in SafePay. The seller only gets paid when you confirm delivery.
            </p>
          </div>

          {/* Before/After Comparison */}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 mb-8 sm:mb-12">
            {/* Without Safepay */}
            <div className="bg-background border border-destructive/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8">
              <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                </div>
                <h3 className="font-bold text-foreground text-sm sm:text-base">Without Safepay</h3>
              </div>
              <ul className="space-y-3 sm:space-y-4">
                {[
                  "Pay upfront to unknown seller",
                  "Hope the product arrives",
                  "No way to get refund if scammed",
                  "Seller disappears with your money"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                    <X className="w-4 h-4 sm:w-5 sm:h-5 text-destructive shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* With Safepay */}
            <div className="bg-gradient-to-br from-success/5 to-success/10 border border-success/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8">
              <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-success/20 flex items-center justify-center">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                </div>
                <h3 className="font-bold text-foreground text-sm sm:text-base">With Safepay</h3>
              </div>
              <ul className="space-y-3 sm:space-y-4">
                {[
                  "Payment locked in SafePay instantly",
                  "Seller ships only after seeing payment",
                  "Confirm delivery to release funds",
                  "Dispute? Full refund guaranteed"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm text-foreground">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-success shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-12 sm:py-16 md:py-28 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <span className="inline-block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 sm:px-3 py-1 rounded-full mb-3 sm:mb-4">
              Simple Process
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6 px-2">
              3 Steps to Protected Payments
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl sm:max-w-2xl mx-auto px-2">
              No complicated setup. No merchant integration required. Just pay safely.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: Wallet,
                title: "Make Payment",
                desc: "Enter amount and merchant details. Your money goes into SafePay — not to the seller."
              },
              {
                step: "02",
                icon: Eye,
                title: "Track Delivery",
                desc: "The merchant ships your order. Track progress and communicate through the platform."
              },
              {
                step: "03",
                icon: CheckCircle,
                title: "Confirm & Release",
                desc: "Received your order? Confirm delivery and funds are released. Any issues? We resolve it."
              }
            ].map((item, i) => (
              <div
                key={i}
                className="relative"
              >
                <div className="bg-background border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 h-full">
                  <span className="font-mono text-3xl sm:text-4xl md:text-5xl font-bold text-primary/20 mb-3 sm:mb-4 block">{item.step}</span>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                    <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground mb-1.5 sm:mb-2">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
                {i < 2 && (
                  <ChevronRight className="hidden md:block absolute -right-4 top-1/2 w-6 h-6 lg:w-8 lg:h-8 text-muted-foreground/30 transform -translate-y-1/2 z-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-12 sm:py-16 md:py-28 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <span className="inline-block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 sm:px-3 py-1 rounded-full mb-3 sm:mb-4">
              Built for Trust
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6 px-2">
              Everything You Need to Pay Safely
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {[
              {
                icon: Lock,
                title: "Secure SafePay",
                desc: "Funds locked until you confirm. Military-grade encryption protects every transaction."
              },
              {
                icon: MessageSquare,
                title: "Dispute Resolution",
                desc: "Issues with your order? Our team mediates and ensures fair outcomes for everyone."
              },
              {
                icon: RefreshCw,
                title: "Instant Refunds",
                desc: "If delivery fails or doesn't match, your money comes back. No questions, no delays."
              },
              {
                icon: Clock,
                title: "Real-time Tracking",
                desc: "Monitor order status, delivery progress, and SafePay timeline in one dashboard."
              },
              {
                icon: ShieldCheck,
                title: "Verified Merchants",
                desc: "Build trust with sellers through verified profiles and transaction history."
              },
              {
                icon: Zap,
                title: "Instant Payments",
                desc: "UPI, cards, net banking — all payment methods supported. Fast and secure."
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group bg-background border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 hover:border-primary/50 hover:shadow-lg transition-all duration-300 active:scale-[0.98]"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-1.5 sm:mb-2 text-sm sm:text-base">{feature.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-12 sm:py-16 md:py-28 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 sm:mb-6 px-2">
            Built on Transparency
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-8 sm:mb-12 max-w-xl sm:max-w-2xl mx-auto px-2">
            No hidden fees. No surprises. Just honest, protected payments.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-12">
            {[
              { label: "SafePay Fee", value: "1-2%", note: "Only on successful transactions" },
              { label: "Buyer Protection", value: "100%", note: "Full refund if delivery fails" },
              { label: "Response Time", value: "<24hrs", note: "Dispute resolution support" }
            ].map((stat, i) => (
              <div key={i} className="bg-background border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6">
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</p>
                <p className="font-medium text-foreground mb-0.5 sm:mb-1 text-sm sm:text-base">{stat.label}</p>
                <p className="text-[11px] sm:text-xs md:text-sm text-muted-foreground">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-28 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-6 sm:mb-8">
            <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">Free to start. No credit card needed.</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6 px-2">
            Ready to Pay Without Fear?
          </h2>
          
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-md sm:max-w-xl mx-auto mb-8 sm:mb-10 px-2">
            Join thousands who've made Safepay their default for online payments. Your money, your control.
          </p>

          {isAuthenticated ? (
            <Link to="/dashboard" className="inline-block w-full sm:w-auto px-4 sm:px-0">
              <Button size="lg" className="h-12 sm:h-14 px-8 sm:px-10 text-sm sm:text-base rounded-full group w-full sm:w-auto">
                Open Dashboard
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center px-4 sm:px-0">
              <Link to="/customer-signup" className="w-full sm:w-auto">
                <Button size="lg" className="h-12 sm:h-14 px-8 sm:px-10 text-sm sm:text-base rounded-full w-full group">
                  Create Free Account
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/customer-login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-12 sm:h-14 px-8 sm:px-10 text-sm sm:text-base rounded-full w-full">
                  Log In
                </Button>
              </Link>
            </div>
          )}

          <p className="text-xs sm:text-sm text-muted-foreground mt-6 sm:mt-8">
            Setup takes less than 2 minutes. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12">
            <div className="col-span-2 sm:col-span-2 md:col-span-1 mb-4 md:mb-0">
              <div className="w-20 sm:w-24 mb-3 sm:mb-4">
                <SafepayLogo />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                SafePay-protected payments for the modern internet.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Product</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-muted-foreground">
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors py-1 block">How It Works</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors py-1 block">Features</a></li>
                <li><Link to="/help" className="hover:text-foreground transition-colors py-1 block">Help &amp; Support</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Company</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground transition-colors py-1 block">About</Link></li>
                <li><Link to="/contact" className="hover:text-foreground transition-colors py-1 block">Contact</Link></li>
                <li><Link to="/grievance-redressal" className="hover:text-foreground transition-colors py-1 block">Grievance Redressal</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Legal</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-muted-foreground">
                <li><Link to="/privacy-policy" className="hover:text-foreground transition-colors py-1 block">Privacy Policy</Link></li>
                <li><Link to="/terms-of-service" className="hover:text-foreground transition-colors py-1 block">Terms of Service</Link></li>
                <li><Link to="/refund-policy" className="hover:text-foreground transition-colors py-1 block">Refund Policy</Link></li>
                <li><Link to="/cookie-policy" className="hover:text-foreground transition-colors py-1 block">Cookie Policy</Link></li>
                <li><Link to="/aml-kyc-policy" className="hover:text-foreground transition-colors py-1 block">AML &amp; KYC Policy</Link></li>
                <li><Link to="/disclaimer" className="hover:text-foreground transition-colors py-1 block">Disclaimer</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 sm:pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
              © {new Date().getFullYear()} Safepay. All rights reserved.
            </p>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
              <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Secured with 256-bit encryption</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
