import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';

export default function Disclaimer() {
  return (
    <LegalPageLayout
      title="Legal Disclaimer"
      subtitle="Limitations, warranties and the legal nature of the Safepay service."
    >
      <LegalSection heading="1. Nature of Service">
        <p>
          Safepay is a technology platform that facilitates buyer-protected payments between
          Customers and Merchants. Safepay is <strong>not a party</strong> to the underlying
          contract of sale between a Customer and a Merchant. We do not manufacture, stock,
          sell, deliver, or warrant any goods or services listed by Merchants.
        </p>
      </LegalSection>

      <LegalSection heading="2. No Banking License">
        <p>
          Safepay is not a bank, deposit-taking institution or non-banking financial company.
          Funds locked in protected payments are held in a designated nodal/settlement account
          operated through licensed banking partners and are <strong>not deposits</strong> with
          Safepay. No interest is payable on amounts held in protected payments.
        </p>
      </LegalSection>

      <LegalSection heading="3. No Investment Advice">
        <p>
          Nothing on the Safepay platform constitutes financial, legal, tax or investment
          advice. Users should obtain independent professional advice before making any
          financial decision.
        </p>
      </LegalSection>

      <LegalSection heading="4. Third-Party Services">
        <p>
          Certain features rely on third parties (payment gateways, banks, couriers, KYC
          providers). Safepay does not control these third parties and is not liable for
          downtime, errors or delays caused by them, except to the extent required by law.
        </p>
      </LegalSection>

      <LegalSection heading="5. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Safepay's aggregate liability arising out of
          or in connection with any transaction shall not exceed the value of that transaction
          or the service fees collected from the affected user in the preceding 12 months,
          whichever is lower. Safepay shall not be liable for any indirect, incidental or
          consequential damages.
        </p>
      </LegalSection>

      <LegalSection heading="6. Force Majeure">
        <p>
          Safepay shall not be liable for any failure or delay caused by events beyond its
          reasonable control including natural disasters, government action, network outages,
          cyber-attacks, war or pandemic.
        </p>
      </LegalSection>

      <LegalSection heading="7. Governing Law">
        <p>
          This disclaimer is governed by the laws of India. Any dispute shall be subject to the
          exclusive jurisdiction of the courts at Bengaluru, Karnataka.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
