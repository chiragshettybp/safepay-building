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
  if (!storedHash.includes(':')) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const legacyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return legacyHash === storedHash;
  }
  
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
  
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = '+91' + cleaned;
  } else if (/^91\d{10}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  } else if (/^\d{11,15}$/.test(cleaned) && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

// Generate possible phone formats for lookup
function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  const variants = new Set<string>();
  
  variants.add(normalized);
  variants.add(cleaned);
  
  if (!cleaned.startsWith('+')) {
    variants.add('+' + cleaned);
  }
  
  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    variants.add('+91' + cleaned);
    variants.add('91' + cleaned);
  }
  
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    variants.add('+' + cleaned);
    variants.add(cleaned.substring(2));
  }
  
  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    variants.add(cleaned.substring(1));
    variants.add(cleaned.substring(3));
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
  
  if (!/^\+?\d{10,15}$/.test(cleaned)) {
    return { valid: false, message: 'Please enter a valid phone number (10-15 digits)' };
  }
  
  return { valid: true, message: '' };
}

serve(async (req) => {
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

    console.log(`Merchant Auth action: ${action}`);

    switch (action) {
      case 'signup': {
        const { 
          phone, 
          password, 
          fullName,
          businessName,
          businessCategory,
          gstNumber,
          businessAddress,
          businessCity,
          businessState,
          businessPincode,
          businessEmail
        } = body;

        if (!phone || !password || !businessName) {
          return new Response(
            JSON.stringify({ error: 'Phone number, password, and business name are required' }),
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

        // Check if phone already exists
        const phoneVariants = getPhoneVariants(phone);
        let existingUser = null;
        
        for (const variant of phoneVariants) {
          const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone', variant)
            .maybeSingle();
          
          if (data) {
            existingUser = data;
            break;
          }
        }

        if (existingUser) {
          // Check if user is already a merchant
          const { data: existingMerchant } = await supabase
            .from('merchants')
            .select('id')
            .eq('user_id', existingUser.id)
            .maybeSingle();

          if (existingMerchant) {
            return new Response(
              JSON.stringify({ error: 'A merchant account with this phone number already exists. Please log in.' }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // User exists but not a merchant - create merchant profile
          const { data: newMerchant, error: merchantError } = await supabase
            .from('merchants')
            .insert({
              user_id: existingUser.id,
              business_name: businessName.trim(),
              business_category: businessCategory || 'general',
              gst_number: gstNumber?.trim() || null,
              business_address: businessAddress?.trim() || null,
              business_city: businessCity?.trim() || null,
              business_state: businessState?.trim() || null,
              business_pincode: businessPincode?.trim() || null,
              business_phone: normalizedPhone,
              business_email: businessEmail?.trim() || null,
              verification_status: 'approved',
            })
            .select()
            .single();

          if (merchantError) {
            console.error('Merchant profile creation error:', merchantError);
            return new Response(
              JSON.stringify({ error: 'Failed to create merchant profile. Please try again.' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Create session
          const token = generateToken();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await supabase
            .from('user_sessions')
            .insert({
              user_id: existingUser.id,
              token,
              expires_at: expiresAt.toISOString(),
            });

          console.log(`Merchant profile created for existing user: ${normalizedPhone}`);

          return new Response(
            JSON.stringify({
              user: {
                id: existingUser.id,
                phone: normalizedPhone,
                fullName: fullName,
              },
              merchant: {
                id: newMerchant.id,
                businessName: newMerchant.business_name,
                verificationStatus: newMerchant.verification_status,
              },
              token,
              expiresAt: expiresAt.toISOString(),
            }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // New user - create profile and merchant
        const { hash: passwordHash } = await hashPassword(password);

        const { data: newUser, error: insertError } = await supabase
          .from('profiles')
          .insert({
            phone: normalizedPhone,
            password_hash: passwordHash,
            full_name: fullName?.trim() || null,
            auth_method: 'phone_password',
            account_source: 'merchant_signup',
            account_claimed: true,
            last_login_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('Profile insert error:', insertError);
          
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

        // Create merchant profile
        const { data: newMerchant, error: merchantError } = await supabase
          .from('merchants')
          .insert({
            user_id: newUser.id,
            business_name: businessName.trim(),
            business_category: businessCategory || 'general',
            gst_number: gstNumber?.trim() || null,
            business_address: businessAddress?.trim() || null,
            business_city: businessCity?.trim() || null,
            business_state: businessState?.trim() || null,
            business_pincode: businessPincode?.trim() || null,
            business_phone: normalizedPhone,
            business_email: businessEmail?.trim() || null,
            verification_status: 'approved',
          })
          .select()
          .single();

        if (merchantError) {
          console.error('Merchant profile creation error:', merchantError);
          // Clean up the profile we just created
          await supabase.from('profiles').delete().eq('id', newUser.id);
          
          return new Response(
            JSON.stringify({ error: 'Failed to create merchant profile. Please try again.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create session token
        const token = generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabase
          .from('user_sessions')
          .insert({
            user_id: newUser.id,
            token,
            expires_at: expiresAt.toISOString(),
          });

        console.log(`Merchant signed up successfully: ${normalizedPhone} (ID: ${newUser.id})`);

        return new Response(
          JSON.stringify({
            user: {
              id: newUser.id,
              phone: newUser.phone,
              fullName: newUser.full_name,
              email: newUser.email,
            },
            merchant: {
              id: newMerchant.id,
              businessName: newMerchant.business_name,
              verificationStatus: newMerchant.verification_status,
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
        console.log('Merchant login attempt - trying phone variants:', phoneVariants);

        // Find user by phone
        let user = null;
        for (const variant of phoneVariants) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('phone', variant)
            .maybeSingle();
          
          if (data && !error) {
            user = data;
            break;
          }
        }

        if (!user) {
          return new Response(
            JSON.stringify({ error: 'No account found with this phone number. Please sign up first.' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if user is a merchant
        const { data: merchant } = await supabase
          .from('merchants')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchant) {
          return new Response(
            JSON.stringify({ error: 'No merchant account found. Please register as a merchant first.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify password
        const isPasswordValid = await verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
          return new Response(
            JSON.stringify({ error: 'Incorrect password. Please try again.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if merchant is active
        if (!merchant.is_active) {
          return new Response(
            JSON.stringify({ error: 'Your merchant account has been deactivated. Please contact support.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update last login
        await supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id);

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

        console.log(`Merchant logged in successfully: ${user.phone}`);

        return new Response(
          JSON.stringify({
            user: {
              id: user.id,
              phone: user.phone,
              fullName: user.full_name,
              email: user.email,
            },
            merchant: {
              id: merchant.id,
              businessName: merchant.business_name,
              businessCategory: merchant.business_category,
              verificationStatus: merchant.verification_status,
              isActive: merchant.is_active,
            },
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

        const { data: session } = await supabase
          .from('user_sessions')
          .select('*, profiles(*)')
          .eq('token', token)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (!session) {
          return new Response(
            JSON.stringify({ error: 'Invalid or expired session' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const profile = session.profiles as any;

        if (!profile) {
          return new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get merchant data
        const { data: merchant } = await supabase
          .from('merchants')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (!merchant) {
          return new Response(
            JSON.stringify({ error: 'No merchant account found' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
            merchant: {
              id: merchant.id,
              businessName: merchant.business_name,
              businessCategory: merchant.business_category,
              verificationStatus: merchant.verification_status,
              isActive: merchant.is_active,
            },
            expiresAt: session.expires_at,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'logout': {
        const { token } = body;

        if (token) {
          await supabase
            .from('user_sessions')
            .delete()
            .eq('token', token);
        }

        return new Response(
          JSON.stringify({ message: 'Logged out successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-status': {
        const { token } = body;

        if (!token) {
          return new Response(
            JSON.stringify({ error: 'Session token is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: session } = await supabase
          .from('user_sessions')
          .select('user_id')
          .eq('token', token)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (!session) {
          return new Response(
            JSON.stringify({ error: 'Invalid session' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: merchant } = await supabase
          .from('merchants')
          .select('verification_status, is_active, rejection_reason, verified_at')
          .eq('user_id', session.user_id)
          .maybeSingle();

        if (!merchant) {
          return new Response(
            JSON.stringify({ error: 'Merchant not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            verificationStatus: merchant.verification_status,
            isActive: merchant.is_active,
            rejectionReason: merchant.rejection_reason,
            verifiedAt: merchant.verified_at,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Merchant auth error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
