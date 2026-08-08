import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';

export default function GrievanceRedressal() {
  return (
    <LegalPageLayout
      title="Grievance Redressal Policy"
      subtitle="Our commitment to resolving customer and merchant complaints fairly and within time."
    >
      <LegalSection heading="1. Purpose">
        <p>
          In line with applicable consumer-protection laws and the directions of the Reserve
          Bank of India for payment service providers, Safepay has established this Grievance
          Redressal Policy to ensure that all complaints are handled promptly, transparently and
          courteously.
        </p>
      </LegalSection>

      <LegalSection heading="2. How to Raise a Grievance">
        <p>You may raise a grievance through any of the following channels:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>In-app "Help &amp; Support" section</li>
          <li>Email: <a href="mailto:grievance@safepay.com" className="text-primary hover:underline">grievance@safepay.com</a></li>
          <li>Written letter to our registered office (see Contact page)</li>
        </ul>
        <p>Please include your full name, registered phone number, order ID (if applicable) and a clear description of the issue.</p>
      </LegalSection>

      <LegalSection heading="3. Resolution Timelines">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Acknowledgement:</strong> within 24 hours of receipt</li>
          <li><strong>Initial response:</strong> within 3 business days</li>
          <li><strong>Final resolution:</strong> within 15 business days for standard issues; up to 30 days for complex cases involving third parties (banks, couriers)</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Escalation Matrix">
        <p><strong>Level 1 — Customer Support:</strong> support@safepay.com</p>
        <p><strong>Level 2 — Grievance Officer:</strong></p>
        <p>
          Ms. A. Sharma<br />
          Grievance Officer, Safepay<br />
          Email: <a href="mailto:grievance.officer@safepay.com" className="text-primary hover:underline">grievance.officer@safepay.com</a><br />
          Hours: Mon–Fri, 10:00–18:00 IST
        </p>
        <p><strong>Level 3 — Nodal Officer:</strong></p>
        <p>
          Mr. R. Iyer<br />
          Nodal Officer, Safepay<br />
          Email: <a href="mailto:nodal@safepay.com" className="text-primary hover:underline">nodal@safepay.com</a>
        </p>
      </LegalSection>

      <LegalSection heading="5. Regulatory Escalation">
        <p>
          If you are not satisfied with the resolution provided, you may approach the RBI
          Ombudsman for Digital Transactions at{' '}
          <a href="https://cms.rbi.org.in" className="text-primary hover:underline" target="_blank" rel="noreferrer">cms.rbi.org.in</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
