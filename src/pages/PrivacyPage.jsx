import LegalPage from './LegalPage'

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">

      <p className="text-ink-muted text-xs uppercase tracking-widest">Last updated: May 2026</p>

      <p>
        This policy describes how JAYL (the "data controller"), an individual seller based in
        Venice, Italy, processes your personal data in compliance with the EU General Data Protection
        Regulation (GDPR — Regulation 2016/679).
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">What data we collect & why</h2>
      <p>
        When you place an order, we collect your <strong className="text-ink">name, email address,
        shipping address, and order details</strong>. This data is used exclusively to process and
        fulfil your order, and to send you transactional emails (order confirmation, shipping
        updates). The legal basis is <em>performance of a contract</em> (Art. 6(1)(b) GDPR).
      </p>
      <p>
        If you submit a contact form, we collect your <strong className="text-ink">name, email,
        and message</strong> to respond to your enquiry. The legal basis is <em>legitimate
        interest</em> (Art. 6(1)(f) GDPR).
      </p>
      <p>
        If you subscribe to our newsletter, we collect your <strong className="text-ink">email
        address</strong> to send you updates. The legal basis is <em>consent</em> (Art. 6(1)(a)
        GDPR), which you can withdraw at any time.
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">Third parties</h2>
      <p>
        We share data only with the following processors, strictly for fulfilment and payment:
      </p>
      <ul className="list-disc pl-5 space-y-1 text-ink-secondary">
        <li>
          <strong className="text-ink">Stripe</strong> — payment processing. Card data never
          touches our servers. Privacy policy:{' '}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4">stripe.com/privacy</a>
        </li>
        <li>
          <strong className="text-ink">Gelato</strong> — print production and shipping. Receives
          your name and shipping address. Privacy policy:{' '}
          <a href="https://www.gelato.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4">gelato.com/privacy-policy</a>
        </li>
        <li>
          <strong className="text-ink">Resend</strong> — transactional email delivery.
        </li>
      </ul>
      <p>
        We do not use cookies for tracking or analytics. We do not sell or share your data with
        any other third parties.
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">Retention</h2>
      <p>
        Order data is retained for 10 years as required by Italian tax law. Contact enquiries are
        deleted within 12 months of resolution. Newsletter subscriptions are retained until you
        unsubscribe.
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">Your rights</h2>
      <p>Under GDPR you have the right to:</p>
      <ul className="list-disc pl-5 space-y-1 text-ink-secondary">
        <li><strong className="text-ink">Access</strong> the personal data we hold about you</li>
        <li><strong className="text-ink">Rectify</strong> inaccurate data</li>
        <li><strong className="text-ink">Erase</strong> your data ("right to be forgotten"), where no legal obligation requires us to retain it</li>
        <li><strong className="text-ink">Portability</strong> — receive your data in a machine-readable format</li>
        <li><strong className="text-ink">Object</strong> to processing based on legitimate interest</li>
        <li><strong className="text-ink">Withdraw consent</strong> at any time (where processing is consent-based)</li>
      </ul>
      <p>
        To exercise any of these rights, email{' '}
        <a href="mailto:thejaylstore@gmail.com" className="text-ink underline underline-offset-4">
          thejaylstore@gmail.com
        </a>
        . We will respond within 30 days.
      </p>
      <p>
        You also have the right to lodge a complaint with the Italian data protection authority,
        the{' '}
        <a
          href="https://www.garanteprivacy.it"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline underline-offset-4"
        >
          Garante per la protezione dei dati personali
        </a>
        .
      </p>

    </LegalPage>
  )
}
