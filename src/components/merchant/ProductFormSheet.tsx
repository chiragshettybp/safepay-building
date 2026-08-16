import { useRef, useState } from 'react';
import { ImagePlus, Loader2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/format';
import type { MerchantProductRow, ProductStatus } from '@/hooks/useMerchantProducts';

interface ProductFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string;
  product: MerchantProductRow | null;
  onSaved: (product: MerchantProductRow) => void;
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  out_of_stock: 'Out of stock',
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function ProductFormSheet({ open, onOpenChange, merchantId, product, onSaved }: ProductFormSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [stock, setStock] = useState(product ? String(product.stock_quantity) : '0');
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? 'active');
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const pickFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`Image is too large (max ${formatFileSize(MAX_IMAGE_BYTES)})`);
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return imagePreview;
    const ext = imageFile.name.split('.').pop() || 'jpg';
    const path = `${merchantId}/${productId}/main.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true });
    if (error) {
      console.error('Image upload error:', error);
      throw error;
    }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const priceNum = Number(price);
    if (!trimmedName) {
      toast.error('Product name is required');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error('Enter a valid price');
      return;
    }
    const stockNum = Math.max(0, Math.floor(Number(stock) || 0));

    setSaving(true);
    try {
      if (product) {
        let imageUrl = imagePreview;
        if (imageFile) {
          try {
            imageUrl = await uploadImage(product.id);
          } catch {
            toast.error('Image upload failed. Product was not updated.');
            setSaving(false);
            return;
          }
        }
        const { data, error } = await supabase
          .from('products')
          .update({
            name: trimmedName,
            description: description.trim() || null,
            price: priceNum,
            sku: sku.trim() || null,
            stock_quantity: stockNum,
            status,
            image_url: imageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id)
          .select()
          .single();
        if (error) throw error;
        toast.success('Product updated');
        onSaved(data as MerchantProductRow);
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert({
            merchant_id: merchantId,
            name: trimmedName,
            description: description.trim() || null,
            price: priceNum,
            sku: sku.trim() || null,
            stock_quantity: stockNum,
            status,
          })
          .select()
          .single();
        if (error) throw error;
        const created = data as MerchantProductRow;
        if (imageFile) {
          try {
            const url = await uploadImage(created.id);
            const { data: updated } = await supabase
              .from('products')
              .update({ image_url: url, updated_at: new Date().toISOString() })
              .eq('id', created.id)
              .select()
              .single();
            onSaved((updated as MerchantProductRow) ?? created);
          } catch {
            toast.warning('Product created but image upload failed');
            onSaved(created);
          }
        } else {
          onSaved(created);
        }
        toast.success('Product created');
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Product save error:', error);
      toast.error(product ? 'Failed to update product' : 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-5 pr-8 text-left">
          <SheetTitle>{product ? 'Edit Product' : 'Add Product'}</SheetTitle>
          <SheetDescription>
            {product ? 'Update pricing, inventory and availability.' : 'Add a product to your catalog.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Image */}
          <div>
            <Label className="mb-2 block text-xs font-medium text-muted-foreground">Product Image</Label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40 transition-colors hover:border-primary/50"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                  <UploadCloud className="h-5 w-5 text-white" />
                </span>
              </button>
              <div className="space-y-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Upload image
                </Button>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="product-name" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Product name <span className="text-destructive">*</span>
            </Label>
            <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cotton T-Shirt" />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="product-desc" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="product-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown to buyers"
              rows={3}
            />
          </div>

          {/* Price + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="product-price" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Price (₹) <span className="text-destructive">*</span>
              </Label>
              <Input id="product-price" type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label htmlFor="product-sku" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                SKU
              </Label>
              <Input id="product-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. TS-001" />
            </div>
          </div>

          {/* Stock + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="product-stock" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Stock quantity
              </Label>
              <Input id="product-stock" type="number" min="0" step="1" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" className={cn('flex-1')} onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {product ? 'Save changes' : 'Add product'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
