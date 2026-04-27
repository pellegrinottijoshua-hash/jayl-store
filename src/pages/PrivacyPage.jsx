import LegalPage from './LegalPage'

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        We collect only the information necessary to process your order: name, email address, and
        shipping address.
      </p>
      <p>
        Payment data is handled securely by Stripe and is never stored on our servers.
      </p>
      <p>
        We do not use cookies for tracking or analytics.
      </p>
      <p>
        We do not sell or share your data with third parties, except Gelato (for order fulfilment)
        and Stripe (for payment processing).
      </p>
      <p>
        For any privacy-related questions, contact us at{' '}
        <a href="mailto:thejaylstore@gmail.com" className="text-ink underline underline-offset-4">
          thejaylstore@gmail.com
        </a>
        .
      </p>
    </LegalPage>
  )
}
