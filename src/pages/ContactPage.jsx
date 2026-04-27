import LegalPage from './LegalPage'

export default function ContactPage() {
  return (
    <LegalPage title="Get in Touch">
      <p>
        Email us at{' '}
        <a href="mailto:thejaylstore@gmail.com" className="text-ink underline underline-offset-4">
          thejaylstore@gmail.com
        </a>{' '}
        for any questions about orders, products, or collaborations.
      </p>
      <p>We aim to respond within 48 hours.</p>
      <p>All orders are fulfilled by Gelato worldwide.</p>
    </LegalPage>
  )
}
