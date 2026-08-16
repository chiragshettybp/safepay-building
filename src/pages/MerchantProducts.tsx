import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Package, Pencil, Plus, RefreshCw, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useMerchantProducts, type MerchantProductRow, type ProductStatus } from '@/hooks/useMerchantProducts';
import { ProductFormSheet } from '@/components/merchant/ProductFormSheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<ProductStatus, { tone: StatusTone; label: string }> = {
  active: { tone: 'success', label: 'Active' },
  inactive: { tone: 'neutral', label: 'Inactive' },
  out_of_stock: { tone: 'warning', label: 'Out of stock' },
};

const FILTERS: Array<{ key: 'all' | ProductStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'out_of_stock', label: 'Out of stock' },
];

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export default function MerchantProducts() {
  const navigate = useNavigate();
  const { merchant } = useMerchantAuth();
  const { loading, error, products, refresh, updateProduct, deleteProduct } = useMerchantProducts(merchant?.id ?? '');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ProductStatus>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MerchantProductRow | null>(null);
  const [deleting, setDeleting] = useState<MerchantProductRow | null>(null);

  const filtered = useMemo(() => {
    let list = products;
    if (filter !== 'all') list = list.filter((p) => p.status === filter);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [products, filter, query]);

  const summary = useMemo(() => {
    const active = products.filter((p) => p.status === 'active').length;
    const outOfStock = products.filter((p) => p.status === 'out_of_stock' || p.stock_quantity === 0).length;
    const inventoryValue = products.reduce((s, p) => s + Number(p.price) * p.stock_quantity, 0);
    return { total: products.length, active, outOfStock, inventoryValue };
  }, [products]);

  const handleSaved = (saved: MerchantProductRow) => {
    setFormOpen(false);
    setEditing(null);
    navigate(`/merchant-products/${saved.id}`);
  };

  const handleToggleStatus = async (p: MerchantProductRow) => {
    const next: ProductStatus = p.status === 'active' ? 'inactive' : 'active';
    const ok = await updateProduct(p.id, { status: next });
    if (ok) toast.success(`Product marked ${next === 'active' ? 'active' : 'inactive'}`);
    else toast.error('Could not update product status');
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const ok = await deleteProduct(deleting.id);
    if (ok) toast.success('Product deleted');
    else toast.error('Could not delete product');
    setDeleting(null);
  };

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <MerchantPageHeader
          title="Products"
          subtitle="Manage your catalog, inventory and pricing."
          actions={
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Product
            </Button>
          }
        />

        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Total Products" value={String(summary.total)} />
            <SummaryCard label="Active" value={String(summary.active)} />
            <SummaryCard label="Out of Stock" value={String(summary.outOfStock)} sub="incl. zero stock" />
            <SummaryCard label="Inventory Value" value={formatAmount(summary.inventoryValue)} />
          </div>
        )}

        {error && (
          <Card className="mb-4 flex items-center justify-between gap-3 border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>
              Try Again
            </Button>
          </Card>
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-border p-0.5 w-fit">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                  filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products or SKU..." className="h-9 pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={query || filter !== 'all' ? 'No matching products' : 'No products yet'}
            description={
              query || filter !== 'all'
                ? 'Try a different search or filter.'
                : 'Add your first product to start building your catalog.'
            }
            action={
              !query && filter === 'all' ? (
                <Button size="sm" onClick={() => setEditing(null)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Product
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const config = STATUS_TONE[p.status] ?? { tone: 'neutral' as StatusTone, label: p.status };
              return (
                <div
                  key={p.id}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/30 active:scale-[0.99]"
                  onClick={() => navigate(`/merchant-products/${p.id}`)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/merchant-products/${p.id}`);
                    }}
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted"
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.sku ? `${p.sku} · ` : ''}
                      {p.stock_quantity} in stock
                    </p>
                  </div>
                  <div className="hidden shrink-0 sm:block">
                    <StatusBadge tone={config.tone} label={config.label} dot className="text-[10px] px-1.5 py-0.5" />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-foreground">{formatAmount(p.price)}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(p);
                      }}
                      className={cn(
                        'mt-0.5 text-[10px] font-medium',
                        p.status === 'active' ? 'text-muted-foreground hover:text-warning' : 'text-success hover:text-success',
                      )}
                    >
                      {p.status === 'active' ? 'Mark inactive' : 'Mark active'}
                    </button>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(p);
                      }}
                      className="hit-44 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Edit product"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(p);
                      }}
                      className="hit-44 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete product"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && products.length === 0 && (
          <Card className="mt-4 flex items-center gap-3 border-border/60 bg-muted/30 p-4">
            <Boxes className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Products you've already sold are auto-created from orders — edit them here to set stock and pricing.
            </p>
          </Card>
        )}
      </div>

      <ProductFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        merchantId={merchant?.id ?? ''}
        product={editing}
        onSaved={handleSaved}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product from your catalog. Orders and past records are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MerchantBottomNav />
    </>
  );
}
