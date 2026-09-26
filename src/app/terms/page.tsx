export default function TermsOfService() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '60px 20px', color: '#f5f5f7' }}>
      <h1>Terms of Service</h1>
      <p style={{ color: '#a0a0ab' }}>Last updated: {new Date().toLocaleDateString()}</p>

      <h2>1. Acceptance</h2>
      <p>
        By using Orbact Repurpose, you agree to these Terms. If you don't agree, please don't use
        the service.
      </p>

      <h2>2. The Service</h2>
      <p>
        Orbact Repurpose generates social media content from content you provide, using
        third-party AI services. Outputs are AI-generated and may require review before posting.
      </p>

      <h2>3. Your Content</h2>
      <p>
        You retain ownership of content you submit and outputs generated for you. You're
        responsible for ensuring you have rights to any content you submit for processing.
      </p>

      <h2>4. Subscriptions & Billing</h2>
      <p>
        Paid plans are billed monthly via Stripe. You may cancel at any time through the billing
        portal; access continues until the end of your current billing period.
      </p>

      <h2>5. Acceptable Use</h2>
      <p>
        You agree not to use the service to generate illegal, harassing, or infringing content,
        or to abuse the service through excessive automated requests.
      </p>

      <h2>6. Disclaimer</h2>
      <p>
        The service is provided "as is." AI-generated outputs may contain errors or inaccuracies
        — you're responsible for reviewing content before publishing it.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        Orbact is not liable for indirect, incidental, or consequential damages arising from use
        of the service.
      </p>

      <h2>8. Contact</h2>
      <p>Questions about these Terms: contact.orbact@gmail.com.</p>
    </div>
  )
}