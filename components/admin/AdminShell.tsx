'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  Page,
  Masthead, MastheadMain, MastheadToggle, MastheadBrand,
  PageSidebar, PageSidebarBody,
  Nav, NavList, NavItem,
  Button,
} from '@patternfly/react-core';
import { BarsIcon } from '@patternfly/react-icons';

const navItems = [
  { href: '/admin/interviews', label: 'Interviews' },
  { href: '/admin/links',      label: 'Links' },
  { href: '/admin/submissions',label: 'Submissions' },
];

export default function AdminShell({ children, userEmail }: { children: React.ReactNode; userEmail?: string | null }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  const masthead = (
    <Masthead>
      <MastheadToggle>
        <Button variant="plain" aria-label="Toggle navigation" onClick={() => setSidebarOpen(o => !o)}>
          <BarsIcon />
        </Button>
      </MastheadToggle>
      <MastheadMain>
        <MastheadBrand>
          <span style={{ fontWeight: 700, color: '#ee0000', fontSize: 16 }}>Red Hat</span>
          <span style={{ marginLeft: 8, color: 'var(--pf-t--global--text--color--subtle)', fontSize: 13 }}>Interview Platform</span>
        </MastheadBrand>
      </MastheadMain>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
        {userEmail && (
          <span style={{ fontSize: 13, color: 'var(--pf-t--global--text--color--subtle)' }}>{userEmail}</span>
        )}
        <Button variant="plain" onClick={() => signOut({ callbackUrl: '/auth/signin' })} style={{ fontSize: 13 }}>
          Sign out
        </Button>
      </div>
    </Masthead>
  );

  const sidebar = (
    <PageSidebar isSidebarOpen={sidebarOpen}>
      <PageSidebarBody>
        <Nav aria-label="Global">
          <NavList>
            {navItems.map(item => (
              <NavItem key={item.href} isActive={pathname.startsWith(item.href)}>
                <Link href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {item.label}
                </Link>
              </NavItem>
            ))}
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page masthead={masthead} sidebar={sidebar} isManagedSidebar={false}>
      {children}
    </Page>
  );
}
