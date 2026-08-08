import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';

export default function Contact() {
  return (
    <LegalPageLayout
      title="Contact Us"
      subtitle="Reach the right team — support, compliance, grievance or business."
    >
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          {
            icon: Mail,
            label: 'Customer Support',
            value: 'support@safepay.com',
            href: 'mailto:support@safepay.com',
            hint: 'Replies within 24 hours',
          },
          {
            icon: Mail,
            label: 'Grievance Officer',
            value: 'grievance@safepay.com',
            href: 'mailto:grievance@safepay.com',
            hint: 'Per RBI norms',
          },
          {
            icon: Mail,
            label: 'Legal & Compliance',
            value: 'legal@safepay.com',
            href: 'mailto:legal@safepay.com',
            hint: 'Subpoenas, AML, takedown',
          },
          {
            icon: Phone,
            label: 'Phone (Mon–Fri, 10–18 IST)',
            value: '+91 80 4710 0000',
            href: 'tel:+918047100000',
            hint: 'For verified account holders',
          },
        ].map((c, i) => (
          <a
            key={i}
            href={c.href}
            className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors flex flex-col gap-2 min-h-[44px]"
          >
            <c.icon className="w-5 h-5 text-primary" />
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="text-sm font-semibold text-foreground break-all">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.hint}</div>
          </a>
        ))}
      </div>

      <LegalSection heading="Registered Office">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-primary mt-1 shrink-0" />
          <p>
            Safepay Technologies Pvt. Ltd.<br />
            14th Floor, Prestige Tower, Outer Ring Road,<br />
            Bengaluru, Karnataka 560103, India<br />
            CIN: U72900KA2024PTC123456
          </p>
        </div>
      </LegalSection>

      <LegalSection heading="Operating Hours">
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-primary mt-1 shrink-0" />
          <p>Monday–Friday, 10:00–18:00 IST. In-app support is available 24/7 for urgent payment issues.</p>
        </div>
      </LegalSection>

      <LegalSection heading="Press &amp; Partnerships">
        <p>
          Media enquiries: <a className="text-primary hover:underline" href="mailto:press@safepay.com">press@safepay.com</a><br />
          Business &amp; integrations: <a className="text-primary hover:underline" href="mailto:partners@safepay.com">partners@safepay.com</a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
