import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';

export default function CookiePolicy() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      subtitle="How Safepay uses cookies and similar technologies."
    >
      <LegalSection heading="1. What Are Cookies">
        <p>
          Cookies are small text files stored on your device when you visit a website or use a
          web-based application. They allow us to recognise your device and remember information
          about your visit, such as your preferences and authentication state.
        </p>
      </LegalSection>

      <LegalSection heading="2. Categories We Use">
        <p><strong>Strictly necessary cookies:</strong> required for authentication, session
          management, fraud prevention and to keep your account secure. These cannot be disabled.
        </p>
        <p><strong>Functional cookies:</strong> remember your preferences (language, last viewed
          screens) to improve your experience.</p>
        <p><strong>Analytics cookies:</strong> help us understand aggregated usage so we can
          improve product quality. We do not use cookies to build advertising profiles.</p>
      </LegalSection>

      <LegalSection heading="3. Third-Party Cookies">
        <p>
          We use a limited number of trusted third-party providers (Razorpay for payments,
          Supabase for backend services). These providers may set their own cookies strictly to
          deliver the service. We do not embed advertising trackers or social media pixels.
        </p>
      </LegalSection>

      <LegalSection heading="4. Managing Cookies">
        <p>
          You can control or delete cookies through your browser settings. Disabling strictly
          necessary cookies will prevent you from signing in or making payments. Disabling
          analytics or functional cookies will not affect the security of your account.
        </p>
      </LegalSection>

      <LegalSection heading="5. Updates">
        <p>
          We may update this Cookie Policy from time to time. Material changes will be notified
          inside the application.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
