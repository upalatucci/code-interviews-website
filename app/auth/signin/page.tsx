'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import {
  ActionGroup, Button, Form, FormGroup, TextInput,
  Title, Alert,
} from '@patternfly/react-core';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn('email', { email: email.trim(), redirect: false });
      if (result?.error) setError('Failed to send magic link. Check your email address.');
      else window.location.href = '/auth/verify-request';
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--pf-t--global--background--color--secondary--default)',
    }}>
      <div style={{ width: 400, padding: 32, background: 'var(--pf-t--global--background--color--primary--default)', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontWeight: 700, fontSize: 22, color: '#ee0000' }}>Red Hat</span>
          <p style={{ margin: '4px 0 0', color: 'var(--pf-t--global--text--color--subtle)' }}>Interview Platform</p>
        </div>

        <Title headingLevel="h1" size="xl" style={{ marginBottom: 8 }}>Sign in</Title>
        <p style={{ marginBottom: 20, color: 'var(--pf-t--global--text--color--subtle)', fontSize: 14 }}>
          Enter your email — we'll send a magic link to sign you in.
        </p>

        {error && (
          <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />
        )}

        <Form onSubmit={handleSubmit}>
          <FormGroup label="Email address" fieldId="email" isRequired>
            <TextInput
              id="email"
              type="email"
              value={email}
              onChange={(_, v) => setEmail(v)}
              placeholder="you@example.com"
              isRequired
              autoFocus
            />
          </FormGroup>
          <ActionGroup>
            <Button type="submit" variant="primary" isLoading={loading} isDisabled={loading} style={{ background: '#ee0000', borderColor: '#ee0000', width: '100%' }}>
              {loading ? 'Sending…' : 'Send magic link'}
            </Button>
          </ActionGroup>
        </Form>
      </div>
    </div>
  );
}
