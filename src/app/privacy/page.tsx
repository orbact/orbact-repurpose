export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '60px 20px', color: '#f5f5f7' }}>
      <h1>Privacy Policy</h1>
      <p style={{ color: '#a0a0ab' }}>Last updated: September 29, 2026</p>

      <h2>1. What We Collect</h2>
      <p>
        When you use Orbact Repurpose, we collect: your email address (for account access),
        content you submit for repurposing (URLs, text, or video links), and generated outputs
        stored in your account history. We use Stripe to process payments and do not store your
        card details ourselves.
      </p>
      <p>
        If you send an Orbact project inquiry, we collect your name, email, optional company,
        selected service, and project description so we can review and respond to it.
      </p>

      <h2>2. How We Use It</h2>
      <p>
        We use your data to operate the service: authenticating you, processing your content
        through third-party AI providers to generate outputs, tracking your usage against your
        plan limits, and billing you via Stripe.
      </p>

      <h2>3. Third-Party Services</h2>
      <p>
        We use Supabase (database and authentication), Groq (AI text generation),
        and Stripe (payment processing) to operate this service. Content
        you submit is sent to these providers as part of generating your outputs.
      </p>

      <h2>4. Data Retention</h2>
      <p>
        Saved generations remain in your account until you delete an individual draft or request
        account deletion by contacting us. Deleting a draft does not restore a used credit.
      </p>

      <h2>5. Your Rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal data at any time.
      </p>

      <h2>6. Contact</h2>
      <p>For questions about this policy, contact us at contact.orbact@gmail.com.</p>
    </div>
  )
}
