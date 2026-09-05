import LegalPage from './LegalPage'

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy">
      <p>
        jayl.store uses essential cookies necessary for the site to function (cart, session).
        No consent is required for these under GDPR.
      </p>
      <p>
        With your consent, we also use analytics cookies (Google Analytics) to understand how
        the site is used, and marketing cookies (Meta Pixel, Pinterest Tag) to measure and
        improve our ads. These only load after you accept them in the cookie banner, and you
        can withdraw consent at any time by clearing your browser's site data and choosing
        "Decline" again.
      </p>
    </LegalPage>
  )
}
