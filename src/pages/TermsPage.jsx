import LegalPage from './LegalPage'

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">

      <p className="text-ink-muted text-xs uppercase tracking-widest">Last updated: May 2026</p>

      <p>
        JAYL is operated by an individual seller based in Venice, Italy. By placing an order or
        using <a href="https://jayl.store" className="text-ink underline underline-offset-4">jayl.store</a>,
        you agree to these terms.
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">Products</h2>
      <p>
        All products are printed on demand by Gelato's global network of print partners. Colours
        and textures may vary slightly from screen representations due to print-production tolerances.
        Prices are displayed in EUR and include VAT where applicable.
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">Ordering & Payment</h2>
      <p>
        Orders are binding once payment is confirmed via Stripe. You will receive an email
        confirmation with your order reference. We reserve the right to cancel or refuse orders at
        our discretion (e.g. in case of pricing errors or suspected fraud), in which case a full
        refund will be issued.
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">Right of Withdrawal</h2>
      <p>
        Under EU Directive 2011/83/EU, consumers normally have a 14-day right of withdrawal for
        distance purchases. However,{' '}
        <strong className="text-ink">this right does not apply</strong> to goods made to the
        consumer's specifications or clearly personalised — which includes all print-on-demand
        products sold on this store (Article&nbsp;16(c)).
      </p>
      <p>
        We do accept returns or reprints for items that arrive{' '}
        <strong className="text-ink">damaged, defective, or incorrectly printed</strong>. See
        our{' '}
        <a href="/returns" className="text-ink underline underline-offset-4">
          Returns &amp; Refunds
        </a>{' '}
        page.
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">Intellectual Property</h2>
      <p>
        All artwork is original and created by JAYL using AI as a creative tool. Unauthorised
        reproduction, distribution, or commercial use of any artwork is prohibited.
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">Limitation of Liability</h2>
      <p>
        Our liability is limited to the value of the order placed. We are not liable for delays
        caused by third-party carriers or Gelato's production network, or for indirect/consequential
        damages.
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">Governing Law & Dispute Resolution</h2>
      <p>
        These terms are governed by Italian law. In the event of a dispute, consumers in the EU
        may also use the{' '}
        <a
          href="https://ec.europa.eu/consumers/odr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline underline-offset-4"
        >
          EU Online Dispute Resolution platform
        </a>
        .
      </p>

      <h2 className="font-display text-xl text-ink mt-8 mb-2">Contact</h2>
      <p>
        For any questions:{' '}
        <a href="mailto:thejaylstore@gmail.com" className="text-ink underline underline-offset-4">
          thejaylstore@gmail.com
        </a>
      </p>

    </LegalPage>
  )
}
