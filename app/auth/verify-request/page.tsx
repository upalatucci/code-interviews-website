export default function VerifyRequestPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ width: 420, padding: 40, textAlign: 'center', background: '#fff', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,.1)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Check your email</h1>
        <p style={{ color: '#666', lineHeight: 1.6 }}>
          A sign-in link has been sent to your email address. Click the link in the email to continue.
        </p>
        <p style={{ marginTop: 16, fontSize: 13, color: '#999' }}>
          The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
        </p>
      </div>
    </div>
  );
}
