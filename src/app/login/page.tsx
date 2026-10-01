import LoginForm from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>
}) {
  const params = await searchParams
  return <LoginForm
    callbackError={params.auth_error !== undefined}
    googleEnabled={process.env.ENABLE_GOOGLE_AUTH !== 'false'}
    emailSignupEnabled={process.env.ENABLE_EMAIL_SIGNUP === 'true'}
    passwordResetEnabled={process.env.ENABLE_EMAIL_RECOVERY === 'true'}
  />
}
