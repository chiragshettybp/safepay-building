import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';

export default function AmlKycPolicy() {
  return (
    <LegalPageLayout
      title="AML &amp; KYC Policy"
      subtitle="Our framework for preventing money laundering and verifying user identities."
    >
      <LegalSection heading="1. Regulatory Framework">
        <p>
          Safepay operates in accordance with the Prevention of Money Laundering Act, 2002
          (PMLA), the rules and master directions issued by the Reserve Bank of India for
          payment system providers, and applicable Know-Your-Customer (KYC) guidelines.
        </p>
      </LegalSection>

      <LegalSection heading="2. Customer Due Diligence">
        <p>All users must complete identity verification before transacting beyond entry-level limits. We collect:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Verified mobile number (used as the primary identifier)</li>
          <li>Full legal name and date of birth</li>
          <li>Address proof (Aadhaar / passport / driver licence)</li>
          <li>PAN for taxation thresholds</li>
          <li>For Merchants: business registration, GSTIN where applicable and beneficial-owner details</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Risk-Based Approach">
        <p>
          Each account is assigned a risk rating (Low, Medium, High) based on transaction
          patterns, geography, business type and behavioural signals. Enhanced due diligence is
          applied to High-risk accounts including periodic reverification and reduced velocity
          limits.
        </p>
      </LegalSection>

      <LegalSection heading="4. Transaction Monitoring">
        <p>
          We continuously monitor transactions for suspicious patterns including structuring,
          rapid in-and-out movement, unusual high-value transfers and links to known bad actors.
          Suspicious activity reports (STRs) are filed with FIU-IND as required.
        </p>
      </LegalSection>

      <LegalSection heading="5. Record Keeping">
        <p>
          KYC documents and transaction records are retained for a minimum of five years from
          the date of the transaction or termination of the account, in line with PMLA
          requirements.
        </p>
      </LegalSection>

      <LegalSection heading="6. Prohibited Activities">
        <ul className="list-disc pl-5 space-y-1">
          <li>Use of Safepay for any unlawful purpose</li>
          <li>Transactions involving sanctioned individuals, entities or jurisdictions</li>
          <li>Use of false identity, mule accounts or proxy KYC</li>
          <li>Sale of regulated goods (firearms, narcotics, prohibited drugs, etc.) without authorisation</li>
        </ul>
        <p>Violations may result in immediate suspension and reporting to law-enforcement agencies.</p>
      </LegalSection>

      <LegalSection heading="7. Designated Officer">
        <p>
          Our Principal Officer for PMLA compliance can be reached at{' '}
          <a href="mailto:compliance@safepay.com" className="text-primary hover:underline">compliance@safepay.com</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
