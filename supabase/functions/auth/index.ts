import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Secure password hashing with salt using PBKDF2
async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const usedSalt = salt || crypto.randomUUID();
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(usedSalt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return { hash: `${usedSalt}:${hash}`, salt: usedSalt };
}

// Verify password against stored hash
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Handle legacy SHA-256 hashes (no salt separator)
  if (!storedHash.includes(':')) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const legacyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return legacyHash === storedHash;
  }
  
  // PBKDF2 hash verification
  const [salt] = storedHash.split(':');
  const { hash } = await hashPassword(password, salt);
  return hash === storedHash;
}

// Generate a secure session token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalize phone number to consistent format
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // If it's a 10-digit Indian number, add +91
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = '+91' + cleaned;
  }
  // If it starts with 91 and is 12 digits, add +
  else if (/^91\d{10}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }
  // Ensure + prefix for international numbers
  else if (/^\d{11,15}$/.test(cleaned) && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

// Generate possible phone formats for lookup (backwards compatibility)
function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  const variants = new Set<string>();
  
  variants.add(normalized);
  variants.add(cleaned);
  
  // Add with + prefix
  if (!cleaned.startsWith('+')) {
    variants.add('+' + cleaned);
  }
  
  // Indian format variants
  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    variants.add('+91' + cleaned);
    variants.add('91' + cleaned);
  }
  
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    variants.add('+' + cleaned);
    variants.add(cleaned.substring(2)); // Without country code
  }
  
  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    variants.add(cleaned.substring(1)); // Without +
    variants.add(cleaned.substring(3)); // Just 10 digits
  }
  
  return Array.from(variants);
}

// Validate password strength
function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true, message: '' };
}

// Validate phone number format
function validatePhone(phone: string): { valid: boolean; message: string } {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Must be at least 10 digits
  if (!/^\+?\d{10,15}$/.test(cleaned)) {
    return { valid: false, message: 'Please enter a valid phone number (10-15 digits)' };
  }
  
  return { valid: true, message: '' };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();
    const body = await req.json();

    console.log(`Auth action: ${action}`);

    switch (action) {
      case 'signup': {
        const { phone, password, fullName } = body;

        if (!phone || !password) {
          return new Response(
            JSON.stringify({ error: 'Phone number and password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate phone
        const phoneValidation = validatePhone(phone);
        if (!phoneValidation.valid) {
          return new Response(
            JSON.stringify({ error: phoneValidation.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const normalizedPhone = normalizePhone(phone);
        
        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          return new Response(
            JSON.stringify({ error: passwordValidation.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if phone already exists (check all possible formats)
        const phoneVariants = getPhoneVariants(phone);
        let existingUser = null;
        
        for (const variant of phoneVariants) {
          const { data } = await supabase
            .from('profiles')
            .select('id, phone, full_name, email, account_source, account_claimed')
            .eq('phone', variant)
            .maybeSingle();
          
          if (data) {
            existingUser = data;
            break;
          }
        }

        // Unclaimed guest profiles (created via SafePay payment links) can be
        // claimed here: the guest's orders then show up in the new account.
        // Any other existing profile is a hard conflict.
        if (existingUser && (existingUser.account_source !== 'payment_link' || existingUser.account_claimed)) {
          return new Response(
            JSON.stringify({ error: 'An account with this phone number already exists. Please log in.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Hash password with salt
        const { hash: passwordHash } = await hashPassword(password);

        // Claim the guest profile or create a new user profile
        let newUser;
        if (existingUser) {
          const { data: claimed, error: claimError } = await supabase
            .from('profiles')
            .update({
              password_hash: passwordHash,
              full_name: fullName?.trim() || existingUser.full_name || null,
              auth_method: 'phone_password',
              account_claimed: true,
              last_login_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id)
            .select()
            .single();

          if (claimError) {
            console.error('Guest profile claim error:', claimError);
            return new Response(
              JSON.stringify({ error: 'Failed to claim account. Please try again.' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          newUser = claimed;
          console.log(`Claimed guest profile for user: ${newUser.id}`);
        } else {
          const { data: created, error: insertError } = await supabase
            .from('profiles')
            .insert({
              phone: normalizedPhone,
              password_hash: passwordHash,
              full_name: fullName?.trim() || null,
              auth_method: 'phone_password',
              account_source: 'signup',
              account_claimed: true,
              last_login_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError) {
            console.error('Profile insert error:', insertError);
            
            // Handle unique constraint violation
            if (insertError.code === '23505') {
              return new Response(
                JSON.stringify({ error: 'An account with this phone number already exists.' }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            return new Response(
              JSON.stringify({ error: 'Failed to create account. Please try again.' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          newUser = created;
        }

        // Auto-create wallet for the new user (idempotent — guests claimed via
        // signup may not have one yet)
        const { error: walletError } = await supabase
          .from('wallets')
          .upsert(
            {
              customer_id: newUser.id,
              balance: 0,
              currency: 'INR',
            },
            { onConflict: 'customer_id', ignoreDuplicates: true }
          );

        if (walletError) {
          console.error('Wallet creation error:', walletError);
          // Don't fail signup if wallet creation fails - it can be created later
        } else {
          console.log(`Wallet ensured for user: ${newUser.id}`);
        }

        // Create session token
        const token = generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

        const { error: sessionError } = await supabase
          .from('user_sessions')
          .insert({
            user_id: newUser.id,
            token,
            expires_at: expiresAt.toISOString(),
          });

        if (sessionError) {
          console.error('Session creation error:', sessionError);
        }

        console.log(`User signed up successfully: ${normalizedPhone} (ID: ${newUser.id})`);

        return new Response(
          JSON.stringify({
            user: {
              id: newUser.id,
              phone: newUser.phone,
              fullName: newUser.full_name,
              email: newUser.email,
            },
            token,
            expiresAt: expiresAt.toISOString(),
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'login': {
        const { phone, password } = body;

        if (!phone || !password) {
          return new Response(
            JSON.stringify({ error: 'Phone number and password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const phoneVariants = getPhoneVariants(phone);
        console.log('Login attempt - trying phone variants:', phoneVariants);

        // Find user by phone (try all variants)
        let user = null;
        for (const variant of phoneVariants) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('phone', variant)
            .maybeSingle();
          
          if (data && !error) {
            user = data;
            console.log(`User found with phone variant: ${variant}`);
            break;
          }
        }

        if (!user) {
          console.log('No user found for phone:', phone);
          return new Response(
            JSON.stringify({ error: 'No account found with this phone number. Please sign up first.' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify password
        const isPasswordValid = await verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
          console.log('Invalid password attempt for user:', user.id);
          return new Response(
            JSON.stringify({ error: 'Incorrect password. Please try again.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update last login timestamp
        await supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id);

        // Ensure user has a wallet (create if missing)
        const { data: existingWallet } = await supabase
          .from('wallets')
          .select('id')
          .eq('customer_id', user.id)
          .maybeSingle();

        if (!existingWallet) {
          await supabase
            .from('wallets')
            .insert({
              customer_id: user.id,
              balance: 0,
              currency: 'INR',
            });
          console.log(`Wallet created for existing user: ${user.id}`);
        }

        // Create session
        const token = generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabase
          .from('user_sessions')
          .insert({
            user_id: user.id,
            token,
            expires_at: expiresAt.toISOString(),
          });

        console.log(`User logged in successfully: ${user.phone} (ID: ${user.id})`);

        return new Response(
          JSON.stringify({
            user: {
              id: user.id,
              phone: user.phone,
              fullName: user.full_name,
              email: user.email,
            },
            token,
            expiresAt: expiresAt.toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'change-password': {
        // Secure password change with current password verification
        const { userId, currentPassword, newPassword, token } = body;

        if (!userId || !currentPassword || !newPassword) {
          return new Response(
            JSON.stringify({ error: 'User ID, current password, and new password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate new password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
          return new Response(
            JSON.stringify({ error: passwordValidation.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify session token if provided
        if (token) {
          const { data: session } = await supabase
            .from('user_sessions')
            .select('user_id')
            .eq('token', token)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
          
          if (!session || session.user_id !== userId) {
            return new Response(
              JSON.stringify({ error: 'Invalid session. Please log in again.' }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Get user and verify current password
        const { data: user } = await supabase
          .from('profiles')
          .select('id, phone, password_hash')
          .eq('id', userId)
          .single();

        if (!user) {
          return new Response(
            JSON.stringify({ error: 'User not found.' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify current password
        const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password_hash);
        if (!isCurrentPasswordValid) {
          console.log('Invalid current password for user:', user.id);
          return new Response(
            JSON.stringify({ error: 'Current password is incorrect.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Ensure new password is different
        const isSameAsOld = await verifyPassword(newPassword, user.password_hash);
        if (isSameAsOld) {
          return new Response(
            JSON.stringify({ error: 'New password must be different from current password.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Hash new password with salt
        const { hash: passwordHash } = await hashPassword(newPassword);

        // Update password
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            password_hash: passwordHash,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Password update error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to change password. Please try again.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Invalidate all other sessions for security (except current if token provided)
        if (token) {
          await supabase
            .from('user_sessions')
            .delete()
            .eq('user_id', user.id)
            .neq('token', token);
        } else {
          await supabase
            .from('user_sessions')
            .delete()
            .eq('user_id', user.id);
        }

        console.log(`Password changed successfully for user: ${user.phone}`);

        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Password changed successfully. Other sessions have been logged out.' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reset-password': {
        // Password reset via phone (forgot password flow - no current password required)
        const { phone, newPassword } = body;

        if (!phone || !newPassword) {
          return new Response(
            JSON.stringify({ error: 'Phone number and new password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate password
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
          return new Response(
            JSON.stringify({ error: passwordValidation.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const phoneVariants = getPhoneVariants(phone);
        
        // Find user by phone
        let user = null;
        for (const variant of phoneVariants) {
          const { data } = await supabase
            .from('profiles')
            .select('id, phone')
            .eq('phone', variant)
            .maybeSingle();
          
          if (data) {
            user = data;
            break;
          }
        }

        if (!user) {
          return new Response(
            JSON.stringify({ error: 'No account found with this phone number.' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Hash new password with salt
        const { hash: passwordHash } = await hashPassword(newPassword);

        // Update password
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            password_hash: passwordHash,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Password update error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to reset password. Please try again.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Invalidate all existing sessions for security
        await supabase
          .from('user_sessions')
          .delete()
          .eq('user_id', user.id);

        // Create new session
        const token = generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabase
          .from('user_sessions')
          .insert({
            user_id: user.id,
            token,
            expires_at: expiresAt.toISOString(),
          });

        console.log(`Password reset successful for: ${user.phone}`);

        return new Response(
          JSON.stringify({
            message: 'Password reset successfully',
            token,
            expiresAt: expiresAt.toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'verify-session': {
        const { token } = body;

        if (!token) {
          return new Response(
            JSON.stringify({ error: 'Session token is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find valid session with user profile
        const { data: session, error: sessionError } = await supabase
          .from('user_sessions')
          .select('*, profiles(*)')
          .eq('token', token)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (sessionError || !session) {
          return new Response(
            JSON.stringify({ error: 'Invalid or expired session. Please log in again.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const profile = session.profiles as any;

        if (!profile) {
          // Session exists but profile was deleted
          await supabase
            .from('user_sessions')
            .delete()
            .eq('token', token);
            
          return new Response(
            JSON.stringify({ error: 'User account not found.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            user: {
              id: profile.id,
              phone: profile.phone,
              fullName: profile.full_name,
              email: profile.email,
            },
            expiresAt: session.expires_at,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'logout': {
        const { token } = body;

        if (token) {
          const { error } = await supabase
            .from('user_sessions')
            .delete()
            .eq('token', token);
            
          if (error) {
            console.error('Logout session delete error:', error);
          } else {
            console.log('Session invalidated successfully');
          }
        }

        return new Response(
          JSON.stringify({ message: 'Logged out successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check-phone': {
        // Check if phone number is already registered
        const { phone } = body;

        if (!phone) {
          return new Response(
            JSON.stringify({ error: 'Phone number is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const phoneVariants = getPhoneVariants(phone);
        let exists = false;

        for (const variant of phoneVariants) {
          const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone', variant)
            .maybeSingle();
          
          if (data) {
            exists = true;
            break;
          }
        }

        return new Response(
          JSON.stringify({ exists }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown authentication action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Auth error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
