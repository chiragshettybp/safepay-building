-- Fix the existing order status to shipped since tracking already exists
UPDATE orders SET status = 'shipped' WHERE id = 'bbfda2a2-0acb-4c8e-a63a-ca37b00ba63c' AND status = 'pending';