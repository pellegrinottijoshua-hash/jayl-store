import LegalPage from './LegalPage'

export default function ReturnsPage() {
  return (
    <LegalPage title="Returns &amp; Refunds">
      <p>
        We accept returns or reprints only for items that arrive damaged, defective, or incorrect.
      </p>
      <p>
        To submit a claim, email{' '}
        <a href="mailto:thejaylstore@gmail.com" className="text-ink underline underline-offset-4">
          thejaylstore@gmail.com
        </a>{' '}
        within <strong className="text-ink">30 days of delivery</strong> with photo evidence of the
        issue.
      </p>
      <p>
        We do not accept returns for change of mind or incorrect size selection. Please refer to the
        size chart on each product page before ordering.
      </p>
    </LegalPage>
  )
}
