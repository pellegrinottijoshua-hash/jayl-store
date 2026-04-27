import LegalPage from './LegalPage'

export default function ShippingPage() {
  return (
    <LegalPage title="Shipping">
      <p>
        All orders are printed on demand and fulfilled by Gelato's global network of 130+ print
        partners worldwide.
      </p>
      <p>
        <strong className="text-ink">Production time:</strong> 2–4 business days.
      </p>
      <p>
        <strong className="text-ink">Shipping time:</strong> Varies by location — typically 3–7
        business days after production.
      </p>
      <p>
        <strong className="text-ink">Free worldwide shipping</strong> on all orders.
      </p>
      <p>
        Orders are shipped from the Gelato facility nearest to you, minimising transit time and
        carbon footprint.
      </p>
      <p>
        Tracking information is sent by email as soon as your order ships.
      </p>
    </LegalPage>
  )
}
