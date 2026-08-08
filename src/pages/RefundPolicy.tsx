import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';

export default function RefundPolicy() {
  return (
    <LegalPageLayout
      title="Refund Policy"
      subtitle="How and when Safepay processes refunds on escrow-protected transactions."
    >
      <LegalSection heading="1. Scope">
        <p>
          This Refund Policy applies to all payments processed through the Safepay platform
          ("Safepay", "we", "us"), operated for transactions between buyers ("Customers") and
          sellers ("Merchants"). Because all Safepay payments are routed through a
          buyer-protection model, refunds are governed by the rules below rather than the
          general policy of any individual Merchant.
        </p>
      </LegalSection>

      <LegalSection heading="2. When You Are Eligible for a Full Refund">
        <p>You are entitled to a full refund of the principal amount when:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>The Merchant fails to ship within the agreed timeline and does not provide valid tracking;</li>
          <li>The product is not delivered within 14 days of payment;</li>
          <li>The product received is materially different from the listing description;</li>
          <li>The product is damaged, defective, counterfeit, or not as advertised;</li>
          <li>A dispute is resolved in your favour by the Safepay Resolution Team.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Service Fees">
        <p>
          The 2% Safepay service fee is fully refunded along with the principal amount in all
          cases where the dispute is resolved in favour of the Customer or where the Merchant
          fails to perform.
        </p>
      </LegalSection>

      <LegalSection heading="4. Refund Timeline">
        <p>
          Approved refunds are initiated within 24 hours and settled to the original payment
          method within 5–7 business days depending on the issuing bank or UPI provider. For
          refunds to a registered bank account, settlement typically completes within 2 business days.
        </p>
      </LegalSection>

      <LegalSection heading="5. How to Request a Refund">
        <p>
          You may request a refund by raising a dispute from the affected order in the Safepay
          app. You will be asked to provide a brief description and supporting evidence
          (photographs, communications, tracking screenshots). The Merchant will be given 72
          hours to respond before Safepay reviews the dispute.
        </p>
      </LegalSection>

      <LegalSection heading="6. Non-Refundable Situations">
        <ul className="list-disc pl-5 space-y-1">
          <li>You confirmed delivery in the app and funds were already released to the Merchant;</li>
          <li>You raised the dispute more than 7 days after confirming delivery;</li>
          <li>The product was damaged due to misuse after confirmed delivery;</li>
          <li>You purchased a clearly marked non-refundable digital good or service.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="7. Chargebacks">
        <p>
          Because Safepay already provides buyer protection, we request that Customers raise a
          dispute within the app before initiating a bank chargeback. Initiating a chargeback in
          parallel may delay resolution.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
